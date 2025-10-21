// lib/authx.ts
import { query } from "@/lib/db";
import { readSessionTokenFromCookies, verifySession } from "@/lib/auth/session";

export type AppUser = {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "moderator" | "user";
};

export async function getCurrentUser(): Promise<AppUser | null> {
  const token = await readSessionTokenFromCookies(); // 👈 добавили await
  const payload = verifySession(token);
  if (!payload?.sub) return null;

  const { rows } = await query<{ id: string; email: string; name: string | null }>(
    `SELECT id, email, name FROM public.users WHERE id = $1 LIMIT 1`,
    [payload.sub]
  );
  if (!rows[0]) return null;

  const roleRes = await query<{ role: "admin" | "moderator" | "user" }>(
    `SELECT role FROM public.profiles WHERE id = $1 LIMIT 1`,
    [payload.sub]
  );

  return {
    id: rows[0].id,
    email: rows[0].email,
    name: rows[0].name,
    role: roleRes.rows[0]?.role ?? "user",
  };
}
