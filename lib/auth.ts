// lib/auth.ts
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { verifySession, SESSION_COOKIE } from '@/lib/auth/session';

export type AuthUser = {
  id: string;
  email: string;
  nickname: string | null;
  created_at: string;
};

export async function getAuthUser(): Promise<AuthUser | null> {
  // Next 15: сначала получить "банку" куки
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value ?? null;

  const payload = await verifySession(token);
  if (!payload?.sub) return null;
  const uid = String(payload.sub);

  // Старая/новая схемы users: сначала пробуем nickname, если нет — name
  try {
    const { rows } = await query<AuthUser>(
      `select id, email, nickname, created_at
         from users where id = $1 limit 1`,
      [uid]
    );
    if (rows[0]) return rows[0];
  } catch (e: any) {
    // 42703 = undefined_column
    if (e?.code !== '42703') throw e;
  }

  try {
    const { rows } = await query<AuthUser>(
      `select id, email, name as nickname, created_at
         from users where id = $1 limit 1`,
      [uid]
    );
    if (rows[0]) return rows[0];
  } catch {}

  return null;
}
