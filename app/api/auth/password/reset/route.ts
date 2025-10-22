// app/api/auth/password/reset/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { assertOriginJSON } from '@/lib/csrf';
import { query } from '@/lib/db';
import { createHash } from 'crypto';
import { hashPassword } from '@/lib/auth/password';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // CSRF-защита
  assertOriginJSON(req);

  try {
    const { token, password } = await req.json();

    if (!token)   return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 400 });
    if (!password) return NextResponse.json({ ok: false, error: 'missing_password' }, { status: 400 });

    // простая валидация пароля
    if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
      return NextResponse.json({ ok: false, error: 'weak_password' }, { status: 400 });
    }

    // находим токен по хэшу в корректной таблице
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const r = await query<{
      user_id: string;
      expires_at: string;
      used_at: string | null;
    }>(
      `SELECT user_id, expires_at, used_at
         FROM password_resets
        WHERE token_hash = $1
        LIMIT 1`,
      [tokenHash]
    );

    const row = r.rows?.[0];
    if (!row)        return NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 400 });
    if (row.used_at) return NextResponse.json({ ok: false, error: 'already_used' }, { status: 400 });
    if (new Date(row.expires_at) < new Date()) {
      return NextResponse.json({ ok: false, error: 'token_expired' }, { status: 400 });
    }

    // хэшируем и записываем новый пароль пользователю
    const newHash = await hashPassword(password);
    await query(
      `UPDATE users
          SET password_hash = $1
        WHERE id = $2`,
      [newHash, row.user_id]
    );

    // помечаем токен использованным
    await query(
      `UPDATE password_resets
          SET used_at = NOW()
        WHERE token_hash = $1`,
      [tokenHash]
    );

    // опционально подчистим просроченные/использованные токены этого пользователя
    await query(
      `DELETE FROM password_resets
        WHERE user_id = $1
          AND (used_at IS NOT NULL OR expires_at < NOW())`,
      [row.user_id]
    ).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[POST /api/auth/password/reset] fatal:', e);
    return NextResponse.json({ ok: false, error: 'internal', message: e?.message }, { status: 500 });
  }
}
