// lib/auth/session.ts
import 'server-only';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, SESSION_JWT_SECRET, shouldUseSecure } from './config';

/* ==================== TYPES ==================== */
export type SessionPayload = {
  sub: string; // user_id (UUID)
  role?: 'admin' | 'moderator' | 'user';
  jti?: string; // jwt id (будет вшит при подписании)
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
const CLOCK_SKEW_SECONDS = 30;             // допуск на дрифт часов

/* ==================== JWT OPERATIONS ==================== */
export function signSession(payload: SessionPayload): string {
  // Вшиваем уникальный идентификатор токена (jti)
  return jwt.sign(payload, SESSION_JWT_SECRET, {
    expiresIn: MAX_AGE_SECONDS,
    algorithm: 'HS256',
    jwtid: randomUUID(),
  });
}

export function verifySession(token?: string | null): SessionPayload | null {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, SESSION_JWT_SECRET, {
      algorithms: ['HS256'],                // явная фиксация алгоритма
      clockTolerance: CLOCK_SKEW_SECONDS,   // допускаем небольшой дрифт часов
    }) as SessionPayload & JwtPayload;

    // Дополнительная явная проверка срока действия (поверх встроенной)
    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof decoded.exp === 'number' && decoded.exp <= nowSec - CLOCK_SKEW_SECONDS) {
      return null;
    }
    // Если когда-нибудь начнёшь ставить nbf — аккуратно отвергаем токены "из будущего"
    if (typeof decoded.nbf === 'number' && decoded.nbf > nowSec + CLOCK_SKEW_SECONDS) {
      return null;
    }

    // Базовая валидация полезной нагрузки
    if (!decoded?.sub || typeof decoded.sub !== 'string') return null;

    return { sub: decoded.sub, role: decoded.role };
  } catch {
    return null;
  }
}

export async function verifySessionStrict(token?: string | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, SESSION_JWT_SECRET, {
      algorithms: ['HS256'],
      clockTolerance: CLOCK_SKEW_SECONDS,
    }) as SessionPayload & JwtPayload & { jti?: string };

    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof decoded.exp === 'number' && decoded.exp <= nowSec - CLOCK_SKEW_SECONDS) return null;
    if (typeof decoded.nbf === 'number' && decoded.nbf >  nowSec + CLOCK_SKEW_SECONDS) return null;
    if (!decoded?.sub || typeof decoded.sub !== 'string') return null;

    // 🔎 Проверка в blacklist
    if (decoded.jti) {
      const { query } = await import('@/lib/db');
      const { rows } = await query<{ revoked: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM revoked_tokens WHERE jti = $1) AS revoked`,
        [decoded.jti]
      );
      if (rows?.[0]?.revoked === true) return null; // токен отозван
    }

    return { sub: decoded.sub, role: decoded.role, jti: decoded.jti };
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
  const payload = await verifySessionStrict(token);
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