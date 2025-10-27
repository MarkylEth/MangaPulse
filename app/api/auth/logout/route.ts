// app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie, getSessionToken, verifySession } from '@/lib/auth/session';
import { assertOriginJSON } from '@/lib/csrf';
import { queryAsUser } from '@/lib/db';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // CSRF
    assertOriginJSON(req);

    // Берём токен из cookies и валидируем
    const token = await getSessionToken();
    const payload = await verifySession(token); // уже проверяет blacklist и token_version

    // Готовим ответ заранее (всегда чистим куку)
    const res = NextResponse.json(
      { ok: true },
      { headers: { 'Cache-Control': 'no-store', Vary: 'Cookie' } }
    );
    clearSessionCookie(res, req);

    // Если есть валидный jti — кладём в blacklist под контекстом пользователя (RLS)
    if (payload?.jti) {
      try {
        await queryAsUser(
          `INSERT INTO revoked_tokens (jti, user_id, expires_at, revoked_at)
           VALUES ($1, $2, now() + interval '30 days', now())
           ON CONFLICT (jti) DO NOTHING`,
          [payload.jti, payload.sub],
          payload.sub
        );
      } catch (e) {
        console.error('[logout] revoke failed:', e instanceof Error ? e.message : e);
        // не роняем logout; кука уже очищена
      }
    }

    return res;
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error('[POST /api/auth/logout] fatal:', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}

