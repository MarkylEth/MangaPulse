// app/api/admin/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdminAPI } from '@/lib/admin/api-guard';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdminAPI(req);

    const id = String(params.id || '').trim();

    if (!id) {
      return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 });
    }

    // Профиль пользователя
    const profileSql = `
      SELECT
        u.id::text AS id,
        u.username,
        u.email,
        u.email_verified_at,
        u.created_at AS user_created_at,
        p.display_name,
        p.avatar_url,
        p.bio,
        COALESCE(p.role, 'user') AS role,
        EXISTS(SELECT 1 FROM user_bans WHERE user_id = u.id AND (expires_at IS NULL OR expires_at > NOW())) as is_banned,
        (SELECT reason FROM user_bans WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) as ban_reason
      FROM users u
      LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.id = $1
      LIMIT 1
    `;

    const prof = await query(profileSql, [id]).then((r) => r.rows?.[0] || null);

    if (!prof) {
      return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 404 });
    }

    // История банов
    let banHistory: any[] = [];
    try {
      const { rows } = await query(
        `SELECT 
          id,
          reason,
          created_at,
          expires_at,
          created_by
         FROM user_bans
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 10`,
        [id]
      );
      banHistory = rows ?? [];
    } catch (e) {
      console.error('Failed to get ban history:', e);
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          profile: prof,
          banHistory
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('[GET /api/admin/users/[id]]:', err);
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}
