// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { assertOriginJSON } from '@/lib/csrf';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { query } from '@/lib/db';
import { sendVerificationEmail } from '@/lib/mail';
import { randomBytes, createHash } from 'crypto';
import { hashPassword } from '@/lib/hash';

type ReqBody = {
  email?: string;
  name?: string;
  password?: string;
};

function getBaseUrl(req: Request) {
  const xfProto = req.headers.get('x-forwarded-proto');
  const xfHost = req.headers.get('x-forwarded-host');
  const host = xfHost || req.headers.get('host');
  const proto = xfProto || 'http';
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL || `http://localhost:${process.env.PORT ?? 3000}`;
}

let ensured = false;
async function ensureAuthSchemaOnce() {
  if (ensured) return;

  await query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

  await query(`
    CREATE TABLE IF NOT EXISTS public.users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text UNIQUE NOT NULL,
      name text,
      password_hash text,
      created_at timestamptz NOT NULL DEFAULT now(),
      email_verified_at timestamptz
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS public.auth_email_tokens (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS auth_email_tokens_token_hash_idx ON public.auth_email_tokens(token_hash);`);
  await query(`CREATE INDEX IF NOT EXISTS auth_email_tokens_email_idx ON public.auth_email_tokens(email);`);

  await query(`
    CREATE TABLE IF NOT EXISTS public.profiles (
      id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
      username text UNIQUE,
      full_name text,
      avatar_url text,
      bio text,
      role text DEFAULT 'user',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      banner_url text,
      about_md text,
      favorite_genres text[],
      telegram text,
      x_url text,
      vk_url text,
      discord_url text
    );
  `);
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON public.profiles (lower(username));`);

  await query(`
    CREATE OR REPLACE FUNCTION public.trg_touch_updated_at() RETURNS trigger AS $$
    BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
  `);
  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'profiles_touch_updated_at') THEN
        CREATE TRIGGER profiles_touch_updated_at
        BEFORE UPDATE ON public.profiles
        FOR EACH ROW EXECUTE PROCEDURE public.trg_touch_updated_at();
      END IF;
    END $$;
  `);

  await query(`
    CREATE OR REPLACE FUNCTION public.ensure_profile_username()
    RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE nick text;
    BEGIN
      nick := COALESCE(NULLIF(NEW.name,''), split_part(NEW.email,'@',1), 'user_'||substr(NEW.id::text,1,8));
      BEGIN
        INSERT INTO public.profiles (id, username, full_name)
        VALUES (NEW.id, nick, COALESCE(NULLIF(NEW.name,''), nick))
        ON CONFLICT (id) DO UPDATE
          SET username = EXCLUDED.username,
              full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);
      EXCEPTION WHEN unique_violation THEN
        INSERT INTO public.profiles (id, username, full_name)
        VALUES (NEW.id, nick || '_' || substr(md5(random()::text),1,4), COALESCE(NULLIF(NEW.name,''), nick))
        ON CONFLICT (id) DO UPDATE
          SET username = EXCLUDED.username,
              full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);
      END;
      RETURN NEW;
    END $$;
  `);
  await query(`DROP TRIGGER IF EXISTS users_after_insert_profile ON public.users;`);
  await query(`
    CREATE TRIGGER users_after_insert_profile
    AFTER INSERT ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.ensure_profile_username();
  `);

  ensured = true;
}

async function storeEmailToken(email: string, tokenHash: string, ttlHours = 24) {
  await query(
    `INSERT INTO public.auth_email_tokens (email, token_hash, expires_at)
     VALUES ($1, $2, now() + ($3 || ' hours')::interval)`,
    [email, tokenHash, String(ttlHours)]
  );
}

export async function POST(req: NextRequest) {
  // CSRF-защита
  assertOriginJSON(req);

  try {
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ ok: false, error: 'email_provider_not_configured' }, { status: 500 });
    }

    await ensureAuthSchemaOnce();

    let body: ReqBody = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 });
    }

    const email = String(body?.email || '').trim().toLowerCase();
    const name = (body?.name || '').trim() || null;
    const pwd = (body?.password || '').trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ ok: false, error: 'bad_email' }, { status: 400 });
    }
    if (!pwd || pwd.length < 6) {
      return NextResponse.json({ ok: false, error: 'weak_password' }, { status: 400 });
    }

    // Проверка, существует ли пользователь
    const existingUser = await query(
      `SELECT id, email_verified_at FROM public.users WHERE email = $1 LIMIT 1`,
      [email]
    );

    if (existingUser.rows.length > 0) {
      if (existingUser.rows[0].email_verified_at) {
        return NextResponse.json({ ok: false, error: 'email_already_registered' }, { status: 400 });
      }
      // Если существует, но не подтвержден — можно повторно отправить письмо
    }

    // Генерация токена подтверждения
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Хешируем пароль
    const pwdHash = await hashPassword(pwd);

    // Апсерт пользователя
    await query(
      `INSERT INTO public.users (email, name, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET
         name = COALESCE(EXCLUDED.name, public.users.name),
         password_hash = EXCLUDED.password_hash`,
      [email, name, pwdHash]
    );

    // Сохраняем токен
    await storeEmailToken(email, tokenHash, 24);

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

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[register] fatal:', e);
    return NextResponse.json({ ok: false, error: 'internal', message: e?.message }, { status: 500 });
  }
}