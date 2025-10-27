// lib/auth.ts
import { queryAsUser } from '@/lib/db';
import { getSessionToken, verifySession } from '@/lib/auth/session';

export type AuthUser = {
  id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  created_at: string; // ISO
  role: 'admin' | 'moderator' | 'user';
};

export async function getAuthUser(): Promise<AuthUser | null> {
  const token = await getSessionToken();
  const payload = await verifySession(token);
  if (!payload?.sub) return null;

  const uid = payload.sub;

  const { rows } = await queryAsUser<{
    id: string;
    email: string | null;
    username: string | null;
    display_name: string | null;
    created_at: string | Date;
    role: 'admin' | 'moderator' | 'user' | null;
  }>(
    `
    SELECT 
       u.id,
       u.email,
       u.username,
       p.display_name,
       u.created_at,
       p.role
      FROM public.users u
 LEFT JOIN public.profiles p ON p.user_id = u.id
     WHERE u.id = $1
     LIMIT 1
    `,
    [uid],
    uid
  );

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    username: row.username,
    display_name: row.display_name,
    created_at:
      typeof row.created_at === 'string'
        ? row.created_at
        : new Date(row.created_at).toISOString(),
    role: (row.role ?? 'user') as 'admin' | 'moderator' | 'user',
  };
}