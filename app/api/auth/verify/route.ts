// app/api/auth/verify/route.ts
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createHash } from 'crypto';
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
      return NextResponse.redirect(toUrl('/login?error=missing_token'));
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Ищем токен
    const r = await query<{
      id: number;
      email: string;
      expires_at: string;
      used_at: string | null;
    }>(
      `SELECT id, email, expires_at, used_at
       FROM public.auth_email_tokens
       WHERE token_hash = $1
       LIMIT 1`,
      [tokenHash]
    );

    const row = r.rows?.[0];
    
    if (!row) {
      return NextResponse.redirect(toUrl('/login?error=invalid_token'));
    }

    // Уже использован
    if (row.used_at) {
      return NextResponse.redirect(toUrl('/login?verified=1&already_used=1'));
    }

    // Просрочен
    if (new Date(row.expires_at) < new Date()) {
      return NextResponse.redirect(toUrl('/login?error=token_expired'));
    }

    // Помечаем использованным
    await query(
      `UPDATE public.auth_email_tokens
       SET used_at = now()
       WHERE token_hash = $1`,
      [tokenHash]
    );

    // Проставляем email_verified_at
    await query(
      `UPDATE public.users
       SET email_verified_at = now()
       WHERE email = $1`,
      [row.email]
    );

    // ✅ Редирект на /login с успехом
    return NextResponse.redirect(toUrl('/login?verified=1'));
  } catch (e: any) {
    console.error('[GET /api/auth/verify] fatal:', e);
    return NextResponse.redirect(toUrl('/login?error=internal'));
  }
}
