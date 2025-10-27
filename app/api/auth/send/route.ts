// app/api/auth/send/route.ts
// мёртвый Файл пока что, нужно создать магические ссылки (выступает за Письмо не пришло? Отправить заново)
import { NextRequest, NextResponse } from 'next/server';
import { assertOriginJSON } from '@/lib/csrf';
import { resend, FROM, APP_URL } from '@/lib/resend';
import { query } from '@/lib/db';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const SECRET = process.env.AUTH_JWT_SECRET!;

function makeToken(email: string) {
  const nonce = crypto.randomUUID();
  const token = jwt.sign({ email, nonce }, SECRET, { expiresIn: '15m' });
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
}

export async function POST(req: NextRequest) {
  assertOriginJSON(req);

  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

    const normalized = email.trim().toLowerCase();
    const { token, tokenHash } = makeToken(normalized);

    await query(
      `insert into auth_email_tokens (email, token_hash, expires_at)
       values ($1, $2, now() + interval '15 minutes')`,
      [normalized, tokenHash]
    );

    const verifyUrl = `${APP_URL}/api/auth/verify?token=${encodeURIComponent(token)}`;

    await resend.emails.send({
      from: FROM,
      to: normalized,
      subject: 'Вход на MangaPulse',
      html: `
        <div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5">
          <h2>Привет!</h2>
          <p>Нажмите, чтобы войти без пароля:</p>
          <p><a href="${verifyUrl}" style="display:inline-block;padding:10px 16px;border-radius:8px;border:1px solid #ddd;text-decoration:none">Войти</a></p>
          <p>Ссылка активна 15 минут.</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
