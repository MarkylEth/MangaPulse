// app/api/admin/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdminAPI } from '@/lib/admin/api-guard';
import { logAdminAction } from '@/lib/admin/audit-log';
export const dynamic = 'force-dynamic';

type Role = 'admin' | 'moderator' | 'user';

function normalizeRole(r: unknown): Role {
  return r === 'admin' || r === 'moderator' ? r : 'user';
}

export async function GET(req: NextRequest) {
  try {
    await requireAdminAPI(req);

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim().toLowerCase();
    const roleParam = searchParams.get('role');
    const roleFilter: Role | null =
      roleParam === 'admin' || roleParam === 'moderator' || roleParam === 'user'
        ? (roleParam as Role)
        : null;

    const params: any[] = [];
    let where = '1=1';

    if (q) {
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
      where += ` AND (
        u.username ILIKE $${params.length - 2}
        OR u.email ILIKE $${params.length - 1}
        OR u.id::text ILIKE $${params.length}
      )`;
    }
    
    if (roleFilter) {
      params.push(roleFilter);
      where += ` AND COALESCE(p.role, 'user') = $${params.length}`;
    }

    const sql = `
      SELECT
        u.id::text AS id,
        u.username,
        u.email,
        u.email_verified_at,
        u.created_at,
        p.display_name,
        COALESCE(p.role, 'user') AS role,
        p.avatar_url,
        EXISTS(
          SELECT 1 FROM user_bans 
          WHERE user_id = u.id 
          AND (expires_at IS NULL OR expires_at > NOW())
        ) as is_banned
      FROM users u
      LEFT JOIN profiles p ON p.user_id = u.id
      WHERE ${where}
      ORDER BY u.created_at DESC
      LIMIT 500
    `;

    const { rows } = await query(sql, params);
    
    return NextResponse.json(
      { ok: true, items: rows },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('[GET /api/admin/users]:', err);
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId: adminId } = await requireAdminAPI(req, { allowSelfModify: false });

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
    }

    const targetUserId = String(body?.id || '').trim();
    const role = normalizeRole(body?.role);

    if (!targetUserId) {
      return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 });
    }

    if (role === 'admin') {
      return NextResponse.json(
        { ok: false, error: 'cannot_assign_admin_role' },
        { status: 403 }
      );
    }

    const { rowCount } = await query(
      `UPDATE profiles 
       SET role = $1, updated_at = NOW() 
       WHERE user_id = $2`,
      [role, targetUserId]
    );

    if (!rowCount) {
      return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 404 });
    }

    await logAdminAction(adminId, 'role_change', targetUserId, {
      ip: req.headers.get('x-forwarded-for')?.split(',')[0],
      newValue: role
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('[POST /api/admin/users]:', err);
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { userId: adminId } = await requireAdminAPI(req, { allowSelfModify: false });

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
    }

    const targetUserId = String(body?.id || '').trim();
    const banned = Boolean(body?.banned);
    const reason = String(body?.reason || 'No reason provided').trim();

    if (!targetUserId) {
      return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 });
    }

    const { rows: targetRows } = await query<{ role: string }>(
      `SELECT COALESCE(role, 'user') AS role
       FROM profiles
       WHERE user_id = $1
       LIMIT 1`,
      [targetUserId]
    );

    if (targetRows[0]?.role === 'admin') {
      return NextResponse.json(
        { ok: false, error: 'cannot_ban_admin' },
        { status: 403 }
      );
    }

    if (banned) {
      // Сначала удаляем старый бан (если есть)
      await query(`DELETE FROM user_bans WHERE user_id = $1`, [targetUserId]);
      
      // Затем вставляем новый
      await query(
        `INSERT INTO user_bans (user_id, reason, created_by, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [targetUserId, reason, adminId]
      );

      // Инвалидируем все сессии пользователя
      await query(
        `UPDATE users 
         SET token_version = COALESCE(token_version, 0) + 1 
         WHERE id = $1`,
        [targetUserId]
      );

      await logAdminAction(adminId, 'user_ban', targetUserId, {
        ip: req.headers.get('x-forwarded-for')?.split(',')[0],
        reason
      });
    } else {
      // Убираем бан
      await query(`DELETE FROM user_bans WHERE user_id = $1`, [targetUserId]);

      await logAdminAction(adminId, 'user_unban', targetUserId, {
        ip: req.headers.get('x-forwarded-for')?.split(',')[0]
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('[PATCH /api/admin/users]:', err);
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}