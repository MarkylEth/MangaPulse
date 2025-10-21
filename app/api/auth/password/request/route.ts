// app/api/auth/password/request/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { assertOriginJSON } from '@/lib/csrf';
import { query } from '@/lib/db';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { sendEmailResend, APP_URL, FROM } from '@/lib/resend';
import { getPasswordResetEmailHtml, getPasswordResetEmailText } from '@/lib/email-templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SECRET = process.env.AUTH_JWT_SECRET!;

function makeToken(email: string) {
  const nonce = crypto.randomUUID();
  const token = jwt.sign({ email, nonce, t: 'pwd' }, SECRET, { expiresIn: '60m' });
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
}

export async function POST(req: NextRequest) {
  // CSRF-защита
  assertOriginJSON(req);

  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ ok: false, error: 'email_required' }, { status: 400 });

    const normalized = String(email).trim().toLowerCase();

    // проверим, есть ли такой пользователь — но ответ всегда 200 (без утечки)
    const u = await query(`select id from public.users where email = $1 limit 1`, [normalized]);

    // генерируем токен в любом случае (но письмо отправим только если юзер есть)
    const { token, tokenHash } = makeToken(normalized);

    // чистим старые токены этого email (не обязательно, но аккуратно)
    await query(`delete from public.auth_password_tokens where email = $1 or expires_at < now()`, [normalized]).catch(() => {});

    // сохраняем новый одноразовый токен (1 час)
    await query(
      `insert into public.auth_password_tokens (email, token_hash, expires_at)
       values ($1, $2, now() + interval '60 minutes')`,
      [normalized, tokenHash]
    );

    if (u.rowCount && u.rowCount > 0) {
      const link = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
      await sendEmailResend({
        to: normalized,
        subject: 'Сброс пароля — MangaPulse',
        html: getPasswordResetEmailHtml(link),
        text: getPasswordResetEmailText(link),
      });
    }

    // всегда ок — чтобы нельзя было по ответу понять, есть ли email
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[POST /api/auth/password/request] fatal:', e);
    return NextResponse.json({ ok: false, error: 'internal', message: e?.message }, { status: 500 });
  }
}