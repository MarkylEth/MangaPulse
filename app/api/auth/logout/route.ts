// app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie, getSessionToken, verifySession } from '@/lib/auth/session';
import { assertOriginJSON } from '@/lib/csrf';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // CSRF защита
    assertOriginJSON(req);
    
    // Получить текущий токен
    const token = await getSessionToken();
    const payload = verifySession(token);
    
    // ✅ Если токен валиден и есть jti - добавить в blacklist
    if (payload && (payload as any).jti) {
      try {
        await query(
          `INSERT INTO revoked_tokens (jti, user_id, expires_at) 
           VALUES ($1, $2, now() + interval '30 days')
           ON CONFLICT (jti) DO NOTHING`,
          [(payload as any).jti, payload.sub]
        );
      } catch (e) {
        // Не критично, если не удалось добавить в blacklist
        console.error('[logout] Failed to revoke token:', e);
      }
    }
    
    // Очистить куку
    const res = NextResponse.json({ ok: true });
    clearSessionCookie(res, req);
    
    return res;
  } catch (e: any) {
    // assertOriginJSON бросает готовый Response
    if (e instanceof Response) return e;
    
    console.error('[POST /api/auth/logout] fatal:', e);
    return NextResponse.json(
      { ok: false, error: 'internal' },
      { status: 500 }
    );
  }
}