// lib/admin/guard.ts
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { verifySessionStrict } from "@/lib/auth/session"; // ✅ ИСПРАВЛЕНО: используем Strict версию
import { SESSION_COOKIE } from "@/lib/auth/config";
import { query } from "@/lib/db";

type Role = "admin" | "moderator" | "user";

/**
 * ✅ ИСПРАВЛЕНО: Теперь использует verifySessionStrict с проверкой blacklist
 */
async function readUserIdFromCookie(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value ?? null;
  const payload = await verifySessionStrict(token); // ✅ добавлен await
  return payload?.sub ? String(payload.sub) : null;
}

/**
 * ✅ ИСПРАВЛЕНО: Запрос к правильной таблице profiles (не public.profiles)
 */
async function getRoleFromDb(userId: string): Promise<Role | null> {
  const r = await query<{ role: Role }>(
    `SELECT COALESCE(role, 'user') as role 
     FROM profiles 
     WHERE user_id = $1 
     LIMIT 1`,
    [userId]
  );
  return r.rows[0]?.role ?? "user";
}

/** Требуется админ */
export async function requireAdmin(): Promise<{ userId: string; role: Role }> {
  const userId = await readUserIdFromCookie();
  if (!userId) notFound();

  const role = (await getRoleFromDb(userId)) ?? "user";
  if (role !== "admin") notFound();

  return { userId, role };
}

/** Требуется админ или модератор */
export async function requireModerator(): Promise<{ userId: string; role: Role }> {
  const userId = await readUserIdFromCookie();
  if (!userId) notFound();

  const role = (await getRoleFromDb(userId)) ?? "user";
  if (role !== "admin" && role !== "moderator") notFound();

  return { userId, role };
}

/** Текущий пользователь (без проверки роли) */
export async function getCurrentUser(): Promise<{ userId: string; role: Role } | null> {
  const userId = await readUserIdFromCookie();
  if (!userId) return null;

  const role = (await getRoleFromDb(userId)) ?? "user";
  return { userId, role };
}