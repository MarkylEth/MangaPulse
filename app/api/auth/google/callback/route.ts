// app/api/auth/google/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { signSession, setSessionCookie } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function redirectWithError(origin: string, code: string, detail?: string) {
  const url = new URL('/', origin);
  url.searchParams.set('auth_error', code);
  if (detail) url.searchParams.set('detail', detail.slice(0, 400));
  return NextResponse.redirect(url);
}

/**
 * ✅ Генерирует уникальный username на основе email или имени
 */
async function generateUsername(base: string): Promise<string> {
  const sanitized = base
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 16) || 'user';

  // Сразу проверяем базовый вариант
  let candidate = sanitized;
  
  for (let i = 1; i <= 999; i++) { // увеличить до 999
    const { rows } = await query<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM users WHERE LOWER(username) = LOWER($1))`,
      [candidate]
    );
    
    if (!rows[0]?.exists) return candidate;
    
    // Используем более компактный формат: user123 вместо user_1234567890
    candidate = `${sanitized}${i}`;
  }
  
  // Fallback: случайный суффикс вместо timestamp
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `${sanitized}_${randomSuffix}`;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code') || '';
  const state = url.searchParams.get('state') || '';

  try {
    // 1) Проверяем state
    const stateResult = await query<{ code_verifier: string; redirect_to: string }>(
      `DELETE FROM public.oauth_states
       WHERE state = $1
       RETURNING code_verifier, COALESCE(redirect_to, '/') AS redirect_to`,
      [state]
    );
    
    if (!stateResult.rowCount || !code) {
      return redirectWithError(url.origin, 'invalid_state');
    }
    
    const { code_verifier, redirect_to } = stateResult.rows[0];

    // 2) Обмениваем код на токены
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code,
        code_verifier,
        grant_type: 'authorization_code',
        redirect_uri: `${url.origin}/api/auth/google/callback`,
      }),
    });

    if (!tokenRes.ok) {
      return redirectWithError(url.origin, 'token_exchange_failed');
    }

    const tokens: any = await tokenRes.json();
    if (!tokens?.access_token) {
      return redirectWithError(url.origin, 'no_access_token');
    }

    // 3) Получаем данные пользователя
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userRes.ok) {
      return redirectWithError(url.origin, 'userinfo_failed');
    }

    const googleUser: {
      sub: string;
      email?: string;
      name?: string;
      picture?: string;
      email_verified?: boolean;
    } = await userRes.json();

    if (!googleUser.sub) {
      return redirectWithError(url.origin, 'no_google_sub');
    }

    await query('BEGIN');

    let userId: string | null = null;

    // 4) Ищем существующего пользователя
    const existing = await query<{ id: string }>(
      `SELECT id FROM users WHERE google_sub = $1 OR email = $2 LIMIT 1`,
      [googleUser.sub, googleUser.email]
    );

    if (existing.rowCount) {
      userId = existing.rows[0].id;

      // ✅ Обновляем google_sub если нашли по email
      await query(
        `UPDATE users SET google_sub = $1 WHERE id = $2`,
        [googleUser.sub, userId]
      );
    } else {
      // 5) Создаём нового пользователя
      const username = await generateUsername(
        googleUser.email?.split('@')[0] || googleUser.name || 'user'
      );

      // ✅ Добавляем проверку email_verified
      const emailVerified = googleUser.email_verified ? 'NOW()' : 'NULL';

      const newUser = await query<{ id: string }>(
        `INSERT INTO users (email, username, google_sub, email_verified_at)
        VALUES ($1, $2, $3, ${emailVerified})
        RETURNING id`,
        [googleUser.email || null, username, googleUser.sub]
      );

      userId = newUser.rows[0].id;

      // ✅ Создаём профиль с аватаром из Google
      await query(
        `INSERT INTO profiles (user_id, display_name, avatar_url)
        VALUES ($1, $2, $3)`,
        [userId, googleUser.name || username, googleUser.picture || null]
      );
    }

    await query('COMMIT');

    // 6) Создаём сессию
    const token = signSession({ sub: userId });
    const response = NextResponse.redirect(new URL(redirect_to || '/', url.origin));
    setSessionCookie(response, token, req);

    return response;

  } catch (error: any) {
    try {
      await query('ROLLBACK');
    } catch {}
    
    console.error('[Google OAuth Error]', error);
    return redirectWithError(url.origin, 'internal_error', error?.message);
  }
}