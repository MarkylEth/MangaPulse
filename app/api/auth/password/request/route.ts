// app/api/auth/password/request/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { assertOriginJSON } from '@/lib/csrf';
import { query } from '@/lib/db';
import crypto from 'crypto';
import { sendEmailResend, APP_URL } from '@/lib/resend';
import { getPasswordResetEmailHtml, getPasswordResetEmailText } from '@/lib/email-templates';

// ✅ анти-брутфорс
import { makeKey, registerFail } from '@/lib/anti-bruteforce';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ✅ простой генератор токена без JWT
function makeToken() {
  const rawToken = crypto.randomBytes(32).toString('hex'); // 64 символа
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { token: rawToken, tokenHash };
}

// helper IP; если есть свой — импортни его и этот удаляй
function getClientIp(req: NextRequest): string {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) {
    const ip = xf.split(',')[0]?.trim();
    if (ip) return ip;
  }
  const xr = req.headers.get('x-real-ip');
  if (xr) return xr;
  const cf = req.headers.get('cf-connecting-ip');
  if (cf) return cf;
  return (req as any).ip || '0.0.0.0';
}

export async function POST(req: NextRequest) {
  // CSRF-защита
  assertOriginJSON(req);

  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ ok: false, error: 'email_required' }, { status: 400 });
    }

    const normalized = String(email).trim().toLowerCase();

    // ✅ rate limiting (аналогично register)
    const ip = getClientIp(req);
    const key = makeKey(ip, normalized);
    const delay = registerFail(key);
    if (delay > 5000) {
      return NextResponse.json(
        { ok: false, error: 'too_many_attempts' },
        { status: 429 }
      );
    }

    // проверяем пользователя — но ответ ВСЕГДА 200 (без утечки существования)
    const u = await query<{ id: string }>(
      `SELECT id FROM public.users WHERE email = $1 LIMIT 1`,
      [normalized]
    );

    // генерируем токен всегда (письмо отправим только если юзер есть)
    const { token, tokenHash } = makeToken();
    const userId = u.rows[0]?.id;

    if (userId) {
      // ❗ чистим старые токены этого пользователя (и/или протухшие)
      await query(
        `DELETE FROM public.password_resets WHERE user_id = $1`,
        [userId]
      );

      // сохраняем новый одноразовый токен (TTL 60 минут)
      await query(
        `INSERT INTO public.password_resets (user_id, token_hash, expires_at)
         VALUES ($1, $2, now() + interval '60 minutes')`,
        [userId, tokenHash]
      );

      // отправляем письмо только если пользователь существует
      const link = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
      await sendEmailResend({
        to: normalized,
        subject: 'Сброс пароля — MangaPulse',
        html: getPasswordResetEmailHtml(link),
        text: getPasswordResetEmailText(link),
      });
    }

    // всегда ok — чтобы нельзя было по ответу понять, есть ли email
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[POST /api/auth/password/request] fatal:', e);
    return NextResponse.json(
      { ok: false, error: 'internal', message: e?.message },
      { status: 500 }
    );
  }
}
