// app/api/admin/users/security/revoke-sessions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { assertOriginJSON } from '@/lib/csrf';
import { query } from '@/lib/db';
import { requireAdminAPI } from '@/lib/admin/api-guard';
import { logAdminAction } from '@/lib/admin/audit-log';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    assertOriginJSON(req);

    // ✅ Запрет отзывать свои сессии
    const { userId: adminId } = await requireAdminAPI(req, { allowSelfModify: false });

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
    }

    const targetUserId = String(body?.id || '').trim();
    if (!targetUserId) {
      return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 });
    }

    // ✅ Инкрементируем token_version - все JWT станут невалидными
    const { rowCount } = await query(
      `UPDATE users 
       SET token_version = COALESCE(token_version, 0) + 1 
       WHERE id = $1`,
      [targetUserId]
    );

    if (rowCount === 0) {
      return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 404 });
    }

    // ✅ Аудит
    await logAdminAction(adminId, 'revoke_sessions', targetUserId, {
      ip: req.headers.get('x-forwarded-for')?.split(',')[0],
      method: 'token_version_increment'
    });

    return NextResponse.json({ ok: true, revoked: 'all' });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('[POST /api/admin/users/security/revoke-sessions]:', err);
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}
