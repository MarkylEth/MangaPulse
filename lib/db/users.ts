// lib/db/users.ts
import { query } from '@/lib/db';

export type DbUser = {
  id: string;
  email: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  role: 'user' | 'moderator' | 'admin';
  email_verified_at: string | null;
  created_at: string;
};

export async function getUserById(id: string): Promise<DbUser | null> {
  const { rows } = await query<DbUser>(
    `SELECT 
      u.id::text AS id,
      u.email,
      u.username,
      u.email_verified_at,
      u.created_at,
      p.display_name,
      p.avatar_url,
      COALESCE(p.role, 'user') AS role
    FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE u.id = $1
    LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function getUserByEmail(email: string): Promise<DbUser | null> {
  const { rows } = await query<DbUser>(
    `SELECT 
      u.id::text AS id,
      u.email,
      u.username,
      u.email_verified_at,
      u.created_at,
      p.display_name,
      p.avatar_url,
      COALESCE(p.role, 'user') AS role
    FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE LOWER(u.email) = LOWER($1)
    LIMIT 1`,
    [email]
  );
  return rows[0] ?? null;
}

export async function getUserByUsername(username: string): Promise<DbUser | null> {
  const { rows } = await query<DbUser>(
    `SELECT 
      u.id::text AS id,
      u.email,
      u.username,
      u.email_verified_at,
      u.created_at,
      p.display_name,
      p.avatar_url,
      COALESCE(p.role, 'user') AS role
    FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE LOWER(u.username) = LOWER($1)
    LIMIT 1`,
    [username]
  );
  return rows[0] ?? null;
}