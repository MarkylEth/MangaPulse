// lib/auth/session.ts
import 'server-only';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

export const SESSION_COOKIE = 'mp_session';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export type SessionPayload = { sub: string };

export async function verifySession(token?: string | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

function shouldUseSecure() {
  const u = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || process.env.SITE_URL || '';
  return u.startsWith('https://');
}

export async function createSession(userId: string) {
  const expiresInSec = Math.floor(THIRTY_DAYS_MS / 1000);
  const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: expiresInSec });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: shouldUseSecure(),
    sameSite: 'lax',
    path: '/',
    maxAge: expiresInSec,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: shouldUseSecure(),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  // подчистим старые названия кук, если где-то остались
  for (const name of ['auth_token','mp_jwt','jwt','access_token','token']) {
    jar.set(name, '', { path: '/', maxAge: 0 });
  }
}
