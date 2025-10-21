// lib/auth/getAuthUser.ts
import 'server-only';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth/session';     // только verify отсюда
import { SESSION_COOKIE } from '@/lib/auth/config';     // ← имя куки из config
import { getUserById } from '@/lib/db/users';

export type AuthUser = {
  id: string;
  email: string;
  nickname: string | null;
  created_at: string;
} | null;

export async function getAuthUser(): Promise<AuthUser> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? null;
  const payload = verifySession(token);                 // синхронный вызов
  const uid = payload?.sub ? String(payload.sub) : null;
  if (!uid) return null;
  return await getUserById(uid);
}
