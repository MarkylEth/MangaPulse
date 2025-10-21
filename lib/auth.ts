// lib/auth.ts
import { query } from "@/lib/db";
import { readSessionTokenFromCookies, verifySession } from "@/lib/auth/session";

export type AuthUser = {
  id: string;
  email: string | null;
  nickname: string | null;
  created_at: string;  // ISO
  role: "admin" | "moderator" | "user";
};

export async function getAuthUser(): Promise<AuthUser | null> {
  const token = await readSessionTokenFromCookies();
  const payload = verifySession(token);
  if (!payload?.sub) return null;

  const { rows } = await query<{
    id: string;
    email: string | null;
    nickname: string | null;
    created_at: string | Date;
    role: "admin" | "moderator" | "user" | null;
  }>(
    `SELECT u.id, u.email, COALESCE(u.nickname, u.name) AS nickname, u.created_at, p.role
       FROM public.users u
  LEFT JOIN public.profiles p ON p.id = u.id
      WHERE u.id = $1
      LIMIT 1`,
    [String(payload.sub)]
  );

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    nickname: row.nickname,
    created_at:
      typeof row.created_at === "string"
        ? row.created_at
        : new Date(row.created_at).toISOString(),
    role: (row.role ?? "user") as "admin" | "moderator" | "user",
  };
}
