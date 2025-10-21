// app/api/auth/verify/route.ts
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createHash } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toUrl(path: string) {
  const base =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    `http://localhost:${process.env.PORT ?? 3000}`;
  return new URL(path, base);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    if (!token) {
      return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 400 });
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');

    // ищем одноразовый токен в новой таблице
    let r = await query<{
      id: number;
      email: string;
      expires_at: string;
      used_at: string | null;
    }>(
      `select id, email, expires_at, used_at
         from public.auth_email_tokens
        where token_hash = $1
        limit 1`,
      [tokenHash],
    );

    if (r.rowCount === 0) {
      // запасной путь — старая таблица, если вдруг используется
      r = await query(
        `select id, email, expires_at, used_at
           from public.auth_tokens
          where token = $1 and type = 'email_verify'
          limit 1`,
        [token],
      );
    }

    const row = r.rows?.[0];
    if (!row) {
      return NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 400 });
    }

    // если уже использован — просто на главную с флагом
    if (row.used_at) {
      return NextResponse.redirect(toUrl('/?verified=1'));
    }

    if (new Date(row.expires_at) < new Date()) {
      return NextResponse.json({ ok: false, error: 'token_expired' }, { status: 400 });
    }

    // помечаем использованным (пытаемся в обе таблицы — на случай fallback)
    await query(
      `update public.auth_email_tokens
          set used_at = now()
        where token_hash = $1`,
      [tokenHash],
    ).catch(() => {});
    await query(
      `update public.auth_tokens
          set used_at = now()
        where token = $1 and type = 'email_verify'`,
      [token],
    ).catch(() => {});

    // проставляем email_verified_at у пользователя
    await query(
      `update public.users
          set email_verified_at = now()
        where email = $1`,
      [row.email],
    );

    // ✅ редирект на ГЛАВНУЮ (а не на /login)
    return NextResponse.redirect(toUrl('/?verified=1'));
  } catch (e: any) {
    console.error('[GET /api/auth/verify] fatal:', e);
    return NextResponse.json({ ok: false, error: 'internal', message: e?.message }, { status: 500 });
  }
}
