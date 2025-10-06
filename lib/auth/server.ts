// lib/auth/server.ts
import 'server-only';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { SESSION_COOKIE, verifySession } from '@/lib/auth/session';

const JWT_COOKIE_CANDIDATES = ['auth_token', 'mp_jwt', 'jwt', 'access_token', 'token'];

type CookieSetOpts = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
  path?: string;
  expires?: Date;
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me'; // в проде обязательно переопредели

function shouldUseSecure(req?: NextRequest | Request) {
  const fwd = (req as NextRequest | undefined)?.headers?.get?.('x-forwarded-proto');
  if (fwd === 'https') return true;
  const site =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.SITE_URL ||
    '';
  return site.startsWith('https://');
}

/* ---------- cookie helpers (Next 15: асинхронные) ---------- */
async function setCookie(name: string, value: string, opts: CookieSetOpts) {
  const store = await cookies();
  store.set({
    name,
    value,
    httpOnly: opts.httpOnly ?? true,
    secure: opts.secure ?? shouldUseSecure(),
    sameSite: opts.sameSite ?? 'lax',
    path: opts.path ?? '/',
    expires: opts.expires,
  });
}

async function getCookie(name: string) {
  const store = await cookies();
  return store.get(name);
}

/* ========== Создание / удаление сессии ========== */
export async function createSession(userId: string, req?: NextRequest | Request) {
  const expiresInSec = Math.floor(THIRTY_DAYS_MS / 1000);
  const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: expiresInSec });

  await setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: shouldUseSecure(req),
    sameSite: 'lax',
    path: '/',
    expires: new Date(Date.now() + THIRTY_DAYS_MS),
  });

  return token;
}

export async function destroySession(req?: NextRequest | Request) {
  await setCookie(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: shouldUseSecure(req),
    sameSite: 'lax',
    path: '/',
    expires: new Date(0),
  });
}

/* ========== Извлечение userId из запроса ========== */
function getBearer(req?: NextRequest | Request): string | null {
  const h: any = (req as any)?.headers;
  const raw = h?.get?.('authorization') || h?.Authorization || h?.authorization;
  const m = typeof raw === 'string' ? raw.match(/^Bearer\s+(.+)$/i) : null;
  return m ? m[1] : null;
}

function pickUserId(payload: any): string | null {
  const cand =
    payload?.sub ??
    payload?.userId ??
    payload?.user_id ??
    payload?.uid ??
    payload?.id ??
    payload?.user?.id;
  return cand != null ? String(cand) : null;
}

export async function getUserIdFromRequest(req?: NextRequest | Request): Promise<string | null> {
  // 1) Основная cookie-сессия
  const token = (await getCookie(SESSION_COOKIE))?.value ?? null;
  if (token) {
    const payload: any = await verifySession(token);
    const id = pickUserId(payload);
    if (id) return id;
  }

  // 2) Authorization: Bearer <JWT>
  const bearer = getBearer(req);
  if (bearer) {
    try {
      const payload: any = jwt.verify(bearer, JWT_SECRET);
      const id = pickUserId(payload);
      if (id) return id;
    } catch {}
  }

  // 3) Fallback — «типовые» имена jwt-кук
  const store = await cookies();
  for (const name of JWT_COOKIE_CANDIDATES) {
    const v = store.get(name)?.value;
    if (!v) continue;
    try {
      const payload: any = jwt.verify(v, JWT_SECRET);
      const id = pickUserId(payload);
      if (id) return id;
    } catch {}
  }

  return null;
}

export async function getAuthUser(req?: NextRequest | Request) {
  const id = await getUserIdFromRequest(req);
  return id ? { id } : null;
}
