// lib/admin/guard.ts
import { redirect } from 'next/navigation';
import { getSessionToken, verifySession } from '@/lib/auth/session';
import { query } from '@/lib/db';

type Role = 'admin' | 'moderator' | 'user';

const isDev = process.env.NODE_ENV === 'development';

/**
 * ✅ Получение роли и banned статуса из БД (БЕЗ active_user_bans view)
 */
async function getRoleFromDb(userId: string): Promise<{ role: Role; banned: boolean }> {
  try {
    const { rows } = await query<{ role: Role; is_banned: boolean }>(
      `SELECT 
        COALESCE(p.role, 'user') as role,
        EXISTS(
          SELECT 1 FROM user_bans 
          WHERE user_id = $1::uuid 
          AND (expires_at IS NULL OR expires_at > NOW())
        ) as is_banned
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.id = $1::uuid
       LIMIT 1`,
      [userId]
    );

    const user = rows[0];

    if (!user) {
      if (isDev) console.log('[GUARD] User not found in database');
      throw new Error('User not found in database');
    }

    return {
      role: user.role || 'user',
      banned: Boolean(user.is_banned),
    };
  } catch (error) {
    if (error instanceof Error) {
      console.error('[GUARD] Database error:', error.message);
    } else {
      console.error('[GUARD] Database error: Unknown');
    }
    throw error;
  }
}

/**
 * ✅ Требует роль admin или moderator
 */
export async function requireAdmin(): Promise<{ userId: string; role: Role }> {
  const token = await getSessionToken();
  const payload = await verifySession(token);

  if (!payload?.sub) {
    if (isDev) console.log('[GUARD] No valid session, showing 404');
    redirect('/404');
  }

  const userId = payload.sub;

  let userData;
  try {
    userData = await getRoleFromDb(userId);
  } catch (error) {
    console.error('[GUARD] Failed to get user data, showing 404');
    redirect('/404');
  }

  // ✅ Проверка на бан
  if (userData.banned) {
    if (isDev) console.log('[GUARD] User is banned, showing 404');
    redirect('/404');
  }

  // ✅ Проверка роли
  if (userData.role !== 'admin' && userData.role !== 'moderator') {
    if (isDev) console.log('[GUARD] Access denied - not admin/moderator, showing 404');
    redirect('/404');
  }

  if (isDev) {
    console.log('[GUARD] ✅ Admin access granted for:', userId.substring(0, 8) + '...');
  }

  return { userId, role: userData.role };
}

/**
 * ✅ Требует роль admin
 */
export async function requireModerator(): Promise<{ userId: string; role: Role }> {
  const token = await getSessionToken();
  const payload = await verifySession(token);

  if (!payload?.sub) {
    if (isDev) console.log('[GUARD] No valid session, showing 404');
    redirect('/404');
  }

  const userId = payload.sub;

  let userData;
  try {
    userData = await getRoleFromDb(userId);
  } catch (error) {
    console.error('[GUARD] Failed to get user data, showing 404');
    redirect('/404');
  }

  // ✅ Проверка на бан
  if (userData.banned) {
    if (isDev) console.log('[GUARD] User is banned, showing 404');
    redirect('/404');
  }

  // ✅ Проверка роли (только admin)
  if (userData.role !== 'admin') {
    if (isDev) console.log('[GUARD] Access denied - not admin, role:', userData.role);
    redirect('/404');
  }

  if (isDev) {
    console.log('[GUARD] ✅ Admin access granted for:', userId.substring(0, 8) + '...');
  }

  return { userId, role: userData.role };
}

/**
 * ✅ Получение текущего пользователя без редиректа
 */
export async function getCurrentUser(): Promise<{ userId: string; role: Role } | null> {
  const token = await getSessionToken();
  const payload = await verifySession(token);

  if (!payload?.sub) {
    return null;
  }

  try {
    const userData = await getRoleFromDb(payload.sub);

    if (userData.banned) {
      if (isDev) console.log('[GUARD] User is banned, returning null');
      return null;
    }

    return { userId: payload.sub, role: userData.role };
  } catch (error) {
    return null;
  }
}

/**
 * ✅ Проверка является ли текущий пользователь админом
 */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === 'admin';
}

/**
 * ✅ Проверка является ли текущий пользователь модератором или админом
 */
export async function isModerator(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === 'admin' || user?.role === 'moderator';
}