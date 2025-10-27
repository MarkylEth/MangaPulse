// app/api/admin/users/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdminAPI } from '@/lib/admin/api-guard';
import { logAdminAction } from '@/lib/admin/audit-log';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest) {
  try {
    // ✅ Запрет изменять свой профиль через админку
    const { userId: adminId } = await requireAdminAPI(req, { allowSelfModify: false });

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
    }

    const targetUserId = String(body?.id || '').trim();
    if (!targetUserId) {
      return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 });
    }

    // Извлекаем поля
    const username = String(body?.username ?? '').trim();
    const email = String(body?.email ?? '').trim();
    const display_name = String(body?.display_name ?? '').trim();
    const bio = String(body?.bio ?? '').trim();
    const avatar_url = String(body?.avatar_url ?? '').trim();

    try {
      await query('BEGIN');

      // Обновляем users (username, email)
      if (username || email) {
        const updates: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (username) {
          updates.push(`username = $${paramIndex++}`);
          params.push(username);
        }
        if (email) {
          updates.push(`email = $${paramIndex++}`);
          params.push(email);
        }

        params.push(targetUserId);

        if (updates.length > 0) {
          await query(
            `UPDATE users
             SET ${updates.join(', ')}, updated_at = NOW()
             WHERE id = $${paramIndex}`,
            params
          );
        }
      }

      // Обновляем profiles
      const { rowCount } = await query(
        `UPDATE profiles
         SET
           display_name = COALESCE(NULLIF($1, ''), display_name),
           bio = COALESCE(NULLIF($2, ''), bio),
           avatar_url = COALESCE(NULLIF($3, ''), avatar_url),
           updated_at = NOW()
         WHERE user_id = $4`,
        [display_name, bio, avatar_url, targetUserId]
      );

      if (rowCount === 0) {
        await query('ROLLBACK');
        return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 404 });
      }

      await query('COMMIT');

      // ✅ Аудит
      await logAdminAction(adminId, 'user_profile_update', targetUserId, {
        ip: req.headers.get('x-forwarded-for')?.split(',')[0],
        changes: { username, email, display_name, bio, avatar_url }
      });

      return NextResponse.json({ ok: true });
    } catch (e) {
      await query('ROLLBACK');
      throw e;
    }
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('[PATCH /api/admin/users/profile]:', err);
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}
