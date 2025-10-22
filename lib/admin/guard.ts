// lib/admin/guard.ts
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { jwtVerify } from 'jose';
import { SESSION_COOKIE, SESSION_JWT_SECRET } from '@/lib/auth/config';

type Role = "admin" | "moderator" | "user";

const JWT_SECRET = new TextEncoder().encode(SESSION_JWT_SECRET);
const isDev = process.env.NODE_ENV === 'development';

async function readUserIdFromCookie(): Promise<string | null> {
  try {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    
    if (!token) {
      if (isDev) console.log('[GUARD] No session cookie');
      return null;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload?.sub ? String(payload.sub) : null;
    
    if (isDev && userId) {
      console.log('[GUARD] User ID from token:', userId.substring(0, 8) + '...');
    }
    
    return userId;
  } catch (error) {
    console.error('[GUARD] Token verification failed:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

async function getRoleFromDb(userId: string): Promise<{ role: Role; banned: boolean }> {
  try {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL!);
    
    const result = await sql`
      SELECT role, banned 
      FROM profiles 
      WHERE user_id = ${userId}::uuid
      LIMIT 1
    `;
    
    const user = result[0];
    
    if (!user) {
      throw new Error('User not found in database');
    }
    
    return {
      role: (user.role as Role) || 'user',
      banned: Boolean(user.banned)
    };
  } catch (error) {
    console.error('[GUARD] DB error:', error instanceof Error ? error.message : 'Unknown error');
    throw error; // ✅ Пробрасываем ошибку вверх
  }
}

export async function requireAdmin(): Promise<{ userId: string; role: Role }> {
  const userId = await readUserIdFromCookie();
  
  if (!userId) {
    redirect('/auth/login');
  }

  let userData;
  try {
    userData = await getRoleFromDb(userId);
  } catch (error) {
    console.error('[GUARD] Failed to get user data');
    redirect('/auth/login');
  }

  // ✅ Проверка на бан
  if (userData.banned) {
    if (isDev) console.log('[GUARD] User is banned');
    redirect('/auth/login?error=banned');
  }

  // ✅ Проверка роли
  if (userData.role !== "admin") {
    if (isDev) console.log('[GUARD] User is not admin, role:', userData.role);
    redirect('/');
  }

  if (isDev) {
    console.log('[GUARD] ✅ Admin access granted');
  }

  return { userId, role: userData.role };
}

export async function requireModerator(): Promise<{ userId: string; role: Role }> {
  const userId = await readUserIdFromCookie();
  
  if (!userId) {
    redirect('/auth/login');
  }

  let userData;
  try {
    userData = await getRoleFromDb(userId);
  } catch (error) {
    console.error('[GUARD] Failed to get user data');
    redirect('/auth/login');
  }

  // ✅ Проверка на бан
  if (userData.banned) {
    if (isDev) console.log('[GUARD] User is banned');
    redirect('/auth/login?error=banned');
  }

  // ✅ Проверка роли
  if (userData.role !== "admin" && userData.role !== "moderator") {
    if (isDev) console.log('[GUARD] User is not admin/moderator, role:', userData.role);
    redirect('/');
  }

  if (isDev) {
    console.log('[GUARD] ✅ Moderator access granted');
  }

  return { userId, role: userData.role };
}

export async function getCurrentUser(): Promise<{ userId: string; role: Role } | null> {
  const userId = await readUserIdFromCookie();
  if (!userId) return null;

  try {
    const userData = await getRoleFromDb(userId);
    
    // ✅ Не возвращаем забаненных пользователей
    if (userData.banned) {
      return null;
    }
    
    return { userId, role: userData.role };
  } catch (error) {
    return null;
  }
}