// lib/admin/guard.ts
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/config";
import { query } from "@/lib/db";

type Role = "admin" | "moderator" | "user";

async function readUserIdFromCookie(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value ?? null;
  const payload = verifySession(token);
  return payload?.sub ? String(payload.sub) : null;
}

async function getRoleFromDb(userId: string): Promise<Role | null> {
  const r = await query<{ role: Role }>(
    `SELECT role FROM public.profiles WHERE id::text = $1 LIMIT 1`,
    [userId]
  );
  return r.rows[0]?.role ?? null;
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
