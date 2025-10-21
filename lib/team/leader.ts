// lib/team/leader.ts
import { query } from '@/lib/db';

/**
 * Возвращает team_id, если user_id — 'lead' в команде, привязанной к тайтлу.
 * Любая ошибка -> null (чтобы не уронить API).
 */
export async function getLeaderTeamIdForTitle(
  userId: string,
  mangaId: number
): Promise<number | null> {
  try {
    const sql = `
      select m.team_id
      from public.translator_team_members m
      join public.translator_team_manga l on l.team_id = m.team_id
      where m.user_id = $1
        and m.role = 'lead'
        and l.manga_id = $2
      limit 1
    `;
    const r = await query<{ team_id: number }>(sql, [userId, mangaId]);
    return r.rows?.[0]?.team_id ?? null;
  } catch {
    return null;
  }
}
