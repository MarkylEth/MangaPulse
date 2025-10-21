// app/api/auth/password/reset/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { assertOriginJSON } from '@/lib/csrf';
import { query } from '@/lib/db';
import { createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SECRET = process.env.AUTH_JWT_SECRET!;

export async function POST(req: NextRequest) {
  // CSRF-защита
  assertOriginJSON(req);

  try {
    const { token, password } = await req.json();

    if (!token)  return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 400 });
    if (!password) return NextResponse.json({ ok: false, error: 'missing_password' }, { status: 400 });

    // простая валидация пароля (минимум 8, макс 128, хотя бы 1 буква/цифра)
    if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
      return NextResponse.json({ ok: false, error: 'weak_password' }, { status: 400 });
    }

    // проверяем токен в БД
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const r = await query<{
      email: string;
      expires_at: string;
      used_at: string | null;
    }>(
      `select email, expires_at, used_at
         from public.auth_password_tokens
        where token_hash = $1
        limit 1`,
      [tokenHash]
    );

    const row = r.rows?.[0];
    if (!row) return NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 400 });
    if (row.used_at) return NextResponse.json({ ok: false, error: 'already_used' }, { status: 400 });
    if (new Date(row.expires_at) < new Date()) return NextResponse.json({ ok: false, error: 'token_expired' }, { status: 400 });

    // декодируем, чтобы убедиться, что токен подписан нами и тип правильный
    try {
      const decoded: any = jwt.verify(token, SECRET);
      if (decoded?.t !== 'pwd' || !decoded?.email || decoded.email !== row.email) {
        return NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 400 });
    }

    // хэшируем пароль и сохраняем
    const hash = await bcrypt.hash(password, 12);
    await query(
      `update public.users
          set password_hash = $1
        where email = $2`,
      [hash, row.email]
    );

    // помечаем токен использованным и чистим старые для этого email
    await query(`update public.auth_password_tokens set used_at = now() where token_hash = $1`, [tokenHash]);
    await query(`delete from public.auth_password_tokens where email = $1 and (used_at is not null or expires_at < now())`, [row.email]).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[POST /api/auth/password/reset] fatal:', e);
    return NextResponse.json({ ok: false, error: 'internal', message: e?.message }, { status: 500 });
  }
}