// lib/auth/session.ts
import 'server-only';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, SESSION_JWT_SECRET, shouldUseSecure } from './config';
import { queryAsUser } from '@/lib/db'; // ⬅️ важно: RLS-контекст

const isDev = process.env.NODE_ENV === 'development';

/* ==================== TYPES ==================== */
export type SessionRole = 'admin' | 'moderator' | 'user';

export type SessionPayload = {
  sub: string;
  role: SessionRole;
  jti: string;
  tv?: number;
};

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  role: SessionRole;
  banned?: boolean;
};

const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const CLOCK_SKEW_SECONDS = 30;

/**
 * ✅ Генерация UUID
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/* ==================== JWT: SIGN ==================== */
export function signSession(p: { sub: string; role: SessionRole; tv?: number }): string {
  if (!p?.sub || typeof p.sub !== 'string') {
    throw new Error('Invalid session payload: sub is required');
  }
  if (!p?.role) {
    throw new Error('Invalid session payload: role is required');
  }

  const jti = generateUUID();
  return jwt.sign(
    {
      sub: p.sub,
      role: p.role,
      jti,
      tv: p.tv ?? 0,
    },
    SESSION_JWT_SECRET,
    {
      expiresIn: MAX_AGE_SECONDS,
      algorithm: 'HS256',
    }
  );
}

/* ==================== JWT: VERIFY (Lite & Full) ==================== */
export function verifySessionLite(token?: string | null): SessionPayload | null {
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, SESSION_JWT_SECRET, {
      algorithms: ['HS256'],
      clockTolerance: CLOCK_SKEW_SECONDS,
    }) as JwtPayload & Partial<SessionPayload>;

    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof decoded.exp === 'number' && decoded.exp <= nowSec - CLOCK_SKEW_SECONDS) return null;
    if (typeof decoded.nbf === 'number' && decoded.nbf > nowSec + CLOCK_SKEW_SECONDS) return null;

    if (!decoded?.sub || typeof decoded.sub !== 'string') return null;
    if (!decoded?.role) return null;
    if (!decoded?.jti) return null;

    return {
      sub: decoded.sub,
      role: decoded.role as SessionRole,
      jti: decoded.jti,
      tv: decoded.tv ?? 0,
    };
  } catch (err) {
    if (isDev)
      console.log('[SESSION] verifySessionLite failed:', err instanceof Error ? err.message : 'Unknown');
    return null;
  }
}

export async function verifySession(token?: string | null): Promise<SessionPayload | null> {
  const lite = verifySessionLite(token);
  if (!lite) return null;

  try {
    // Читаем blacklist + текущую token_version пользователя под его контекстом (RLS)
    const { rows } = await queryAsUser<{
      revoked: boolean;
      current_tv: number;
    }>(
      `
      SELECT
        EXISTS (SELECT 1 FROM revoked_tokens WHERE jti = $1) AS revoked,
        COALESCE((SELECT token_version FROM users WHERE id = $2), 0) AS current_tv
      `,
      [lite.jti, lite.sub],
      lite.sub
    );

    const row = rows?.[0];

    if (row?.revoked) {
      if (isDev) console.log('[SESSION] Token is revoked (blacklisted)');
      return null;
    }

    const tokenTv = lite.tv ?? 0;
    const currentTv = row?.current_tv ?? 0;

    if (tokenTv < currentTv) {
      if (isDev) console.log('[SESSION] Token version mismatch (token=%d, current=%d)', tokenTv, currentTv);
      return null;
    }

    return lite;
  } catch (error) {
    console.error('[SESSION] Verification failed:', error instanceof Error ? error.message : 'Unknown');
    return null;
  }
}

export const verifySessionStrict = verifySession;

/* ==================== COOKIE OPERATIONS ==================== */
export async function getSessionToken(): Promise<string | null> {
  try {
    const store = await cookies();
    return store.get(SESSION_COOKIE)?.value ?? null;
  } catch (error) {
    if (isDev)
      console.error('[SESSION] Failed to get session token:', error instanceof Error ? error.message : 'Unknown');
    return null;
  }
}

export function setSessionCookie(res: NextResponse, token: string, _req?: NextRequest): void {
  const secure = shouldUseSecure;
  if (!isDev && !secure) {
    console.warn('[SESSION] WARNING: Setting session cookie without secure flag in production!');
  }

  res.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });

  if (isDev) console.log('[SESSION] Cookie set (httpOnly, sameSite=lax, secure=%s)', String(secure));
}

export function clearSessionCookie(res: NextResponse, _req?: NextRequest): void {
  const secure = shouldUseSecure;
  res.cookies.set({
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  if (isDev) console.log('[SESSION] Cookie cleared');
}

/* ==================== USER OPERATIONS ==================== */
export async function getSessionUser(): Promise<AuthUser | null> {
  const token = await getSessionToken();
  const payload = await verifySession(token);
  if (!payload?.sub) return null;

  try {
    // ВАЖНО: читаем users/profiles под контекстом пользователя (RLS)
    const { rows } = await queryAsUser<{
      id: string;
      email: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
      role: SessionRole;
      is_banned: boolean;
    }>(
      `
      SELECT 
         u.id,
         u.email,
         u.username,
         p.display_name,
         p.avatar_url,
         COALESCE(p.role, 'user') as role,
         EXISTS(
           SELECT 1 FROM user_bans 
           WHERE user_id = u.id 
             AND (expires_at IS NULL OR expires_at > NOW())
         ) as is_banned
      FROM users u
      LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.id = $1
      LIMIT 1
      `,
      [payload.sub],
      payload.sub
    );

    const user = rows[0];
    if (!user) return null;
    if (user.is_banned) return null;

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      role: user.role,
      banned: user.is_banned,
    };
  } catch (error) {
    console.error('[SESSION] Database error:', error instanceof Error ? error.message : 'Unknown');
    return null;
  }
}

/* ==================== CONVENIENCE FUNCTIONS ==================== */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getSessionUser();
  if (!user) throw new Error('UNAUTHORIZED');
  return user;
}

export async function requireRole(role: 'admin' | 'moderator'): Promise<AuthUser> {
  const user = await requireAuth();
  if (role === 'admin' && user.role !== 'admin') throw new Error('FORBIDDEN');
  if (role === 'moderator' && user.role !== 'admin' && user.role !== 'moderator') throw new Error('FORBIDDEN');
  return user;
}

/* ==================== REVOKE ==================== */
export async function revokeToken(jti: string, userId?: string): Promise<void> {
  await queryAsUser(
    `
    INSERT INTO revoked_tokens (jti, user_id, expires_at, revoked_at) 
    VALUES ($1, $2, NOW() + INTERVAL '30 days', NOW()) 
    ON CONFLICT (jti) DO NOTHING
    `,
    [jti, userId || null],
    userId || '00000000-0000-0000-0000-000000000000' // безопасно: не влияет на RLS revoked_tokens
  );
  if (isDev) console.log('[SESSION] Token revoked:', jti.slice(0, 8) + '…');
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  // повышаем token_version в своей строке users (через RLS-контекст)
  await queryAsUser(
    `
    UPDATE users 
       SET token_version = COALESCE(token_version, 0) + 1 
     WHERE id = $1
    `,
    [userId],
    userId
  );
  if (isDev) console.log('[SESSION] All tokens revoked for user:', userId);
}

/* ==================== LEGACY ALIASES ==================== */
export const getAuthUser = getSessionUser;
export const getCurrentUser = getSessionUser;
export const readSessionTokenFromCookies = getSessionToken;
export const createSession = setSessionCookie;
export const destroySession = clearSessionCookie;
