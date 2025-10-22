// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { assertOriginJSON } from '@/lib/csrf';
import { query } from '@/lib/db';
import { sendVerificationEmail } from '@/lib/mail';
import { randomBytes, createHash } from 'crypto';
import { hashPassword } from '@/lib/auth/password';

// ✅ анти-брутфорс
import { makeKey, registerFail, resetCounter } from '@/lib/anti-bruteforce';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ReqBody = {
  email?: string;
  name?: string;
  password?: string;
};

// ✅ ДОБАВИТЬ: функция задержки
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Небольшой helper для IP; замени на свой импорт, если он у тебя уже есть
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

function getBaseUrl(req: Request) {
  const xfProto = req.headers.get('x-forwarded-proto');
  const xfHost = req.headers.get('x-forwarded-host');
  const host = xfHost || req.headers.get('host');
  const proto = xfProto || 'http';
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL || `http://localhost:${process.env.PORT ?? 3000}`;
}

/**
 * ✅ Генерирует уникальный username на основе email или name
 */
async function generateUsername(base: string): Promise<string> {
  const sanitized = base
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 20) || 'user';

  // Проверяем занятость
  let candidate = sanitized;
  for (let i = 1; i <= 100; i++) {
    const { rows } = await query<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM users WHERE LOWER(username) = LOWER($1))`,
      [candidate]
    );

    if (!rows[0]?.exists) return candidate;

    candidate = `${sanitized}${i}`;
  }

  // Fallback: добавляем timestamp
  return `${sanitized}_${Date.now().toString(36)}`;
}

async function storeEmailToken(email: string, tokenHash: string, ttlHours = 24) {
  await query(
    `INSERT INTO auth_email_tokens (email, token_hash, expires_at)
     VALUES ($1, $2, now() + ($3 || ' hours')::interval)`,
    [email, tokenHash, String(ttlHours)]
  );
}

export async function POST(req: NextRequest) {
  // CSRF-защита
  assertOriginJSON(req);

  // ✅ rate limiting / anti-bruteforce
  const ip = getClientIp(req);
  const key = makeKey(ip, 'register');

  const delay = registerFail(key);
  if (delay > 5000) {
    return NextResponse.json(
      { ok: false, error: 'too_many_attempts' },
      {
        status: 429,
        headers: {
          'Retry-After': '60',
        },
      }
    );
  }

  try {
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { ok: false, error: 'email_provider_not_configured' },
        { status: 500 }
      );
    }

    let body: ReqBody = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 });
    }

    const email = String(body?.email || '').trim().toLowerCase();
    const displayName = (body?.name || '').trim() || null;
    const pwd = (body?.password || '').trim();

    // Валидация
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ ok: false, error: 'bad_email' }, { status: 400 });
    }
    if (!pwd || pwd.length < 6) {
      return NextResponse.json({ ok: false, error: 'weak_password' }, { status: 400 });
    }

    // Проверка, существует ли пользователь
    const existingUser = await query(
      `SELECT id, email_verified_at FROM users WHERE email = $1 LIMIT 1`,
      [email]
    );

    // ✅ ИСПРАВЛЕНИЕ: убрать дублирование условия
    if (existingUser.rows.length > 0) {
      // Не раскрываем, существует ли email
      await sleep(1000); // Искусственная задержка для совпадения таймингов
      return NextResponse.json(
        { ok: true }, // Всегда возвращаем успех
        { status: 200 }
      );
    }

    // ✅ Генерируем username из email или name
    const username = await generateUsername(
      displayName || email.split('@')[0] || 'user'
    );

    // Генерация токена подтверждения
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Хешируем пароль
    const pwdHash = await hashPassword(pwd);

    await query('BEGIN');

    try {
      // ✅ Создаём пользователя с username
      await query(
        `INSERT INTO users (email, username, password_hash)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE SET
           username = EXCLUDED.username,
           password_hash = EXCLUDED.password_hash`,
        [email, username, pwdHash]
      );

      // ✅ Профиль создастся автоматически через trigger
      // Но если нужно установить display_name:
      await query(
        `UPDATE profiles 
         SET display_name = $2
         WHERE user_id = (SELECT id FROM users WHERE email = $1)`,
        [email, displayName]
      );

      // Сохраняем токен
      await storeEmailToken(email, tokenHash, 24);

      await query('COMMIT');
    } catch (error: any) {
      await query('ROLLBACK');

      // Обработка конфликта username
      if (error?.code === '23505' && error?.constraint?.includes('username')) {
        return NextResponse.json(
          { ok: false, error: 'username_generation_failed' },
          { status: 500 }
        );
      }

      throw error;
    }

    // Отправка письма
    const base = getBaseUrl(req);
    const link = `${base}/api/auth/verify?token=${encodeURIComponent(token)}`;

    const sent = await sendVerificationEmail(email, link, 'signup');
    if (!sent.ok) {
      return NextResponse.json(
        { ok: false, error: 'resend_error', detail: sent.error },
        { status: 502 }
      );
    }

    // ✅ при успехе — сбрасываем счётчик брутфорса
    resetCounter(key);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[POST /api/auth/register] fatal:', e);
    
    // ✅ ИСПРАВЛЕНИЕ: не отправлять e?.message в production
    const isProduction = process.env.NODE_ENV === 'production';
    
    return NextResponse.json(
      { 
        ok: false, 
        error: 'internal',
        ...(isProduction ? {} : { message: e?.message })
      },
      { status: 500 }
    );
  }
}