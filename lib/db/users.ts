// lib/db/users.ts
import { query } from '@/lib/db';

const USERS_TABLE = process.env.DB_USERS_TABLE ?? 'users';

export type DbUser = {
  id: string;
  email: string;
  nickname: string | null;
  created_at: string;
};

export async function getUserById(id: string): Promise<DbUser | null> {
  // поддерживаем и nickname, и name=>nickname (чтобы не падать на старых схемах)
  try {
    const { rows } = await query<DbUser>(
      `select id, email, nickname, created_at from ${USERS_TABLE} where id = $1 limit 1`,
      [id]
    );
    return rows[0] ?? null;
  } catch (e: any) {
    if (e?.code !== '42703') throw e; // столбца нет — пробуем name as nickname
  }
  const { rows } = await query<DbUser>(
    `select id, email, name as nickname, created_at from ${USERS_TABLE} where id = $1 limit 1`,
    [id]
  );
  return rows[0] ?? null;
}
