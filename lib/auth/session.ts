// lib/auth/session.ts
import 'server-only';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, SESSION_JWT_SECRET, shouldUseSecure } from './config';

/* ==================== TYPES ==================== */
export type SessionPayload = {
  sub: string; // user_id (UUID)
  role?: 'admin' | 'moderator' | 'user';
};

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  role: 'admin' | 'moderator' | 'user';
};

const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

/* ==================== JWT OPERATIONS ==================== */
export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, SESSION_JWT_SECRET, { expiresIn: MAX_AGE_SECONDS });
}

export function verifySession(token?: string | null): SessionPayload | null {
  if (!token) return null;
  try {
    return jwt.verify(token, SESSION_JWT_SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

/* ==================== COOKIE OPERATIONS ==================== */
export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export function setSessionCookie(res: NextResponse, token: string, req?: NextRequest) {
  res.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: shouldUseSecure(req),
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(res: NextResponse, req?: NextRequest) {
  res.cookies.set({
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: shouldUseSecure(req),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

/* ==================== USER OPERATIONS ==================== */
/**
 * ✅ ЕДИНСТВЕННАЯ функция для получения пользователя из сессии
 * Использовать везде: в app router, api routes, middleware
 */
export async function getSessionUser(): Promise<AuthUser | null> {
  const token = await getSessionToken();
  const payload = verifySession(token);
  if (!payload?.sub) return null;

  // ✅ Одним запросом получаем всё нужное
  const { query } = await import('@/lib/db');
  const { rows } = await query<{
    id: string;
    email: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    role: 'admin' | 'moderator' | 'user';
  }>(
    `SELECT 
      u.id,
      u.email,
      u.username,
      p.display_name,
      p.avatar_url,
      COALESCE(p.role, 'user') as role
    FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE u.id = $1
    LIMIT 1`,
    [payload.sub]
  );

  if (!rows[0]) return null;

  return {
    id: rows[0].id,
    email: rows[0].email,
    username: rows[0].username,
    display_name: rows[0].display_name,
    avatar_url: rows[0].avatar_url,
    role: rows[0].role,
  };
}

/* ==================== CONVENIENCE FUNCTIONS ==================== */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error('UNAUTHORIZED');
  }
  return user;
}

export async function requireRole(role: 'admin' | 'moderator'): Promise<AuthUser> {
  const user = await requireAuth();
  if (role === 'admin' && user.role !== 'admin') {
    throw new Error('FORBIDDEN');
  }
  if (role === 'moderator' && user.role !== 'admin' && user.role !== 'moderator') {
    throw new Error('FORBIDDEN');
  }
  return user;
}

/* ==================== LEGACY ALIASES (для обратной совместимости) ==================== */
export const getAuthUser = getSessionUser;
export const getCurrentUser = getSessionUser;
export const readSessionTokenFromCookies = getSessionToken;
export const createSession = setSessionCookie;
export const destroySession = clearSessionCookie;