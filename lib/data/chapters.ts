// lib/data/chapters.ts
import { query } from '@/lib/db';

type OrderBy = 'created_at' | 'number';
type OrderDir = 'asc' | 'desc';

export async function getPublicChaptersByManga(
  mangaId: number,
  { limit = 0, order = 'desc', by = 'created_at' as OrderBy } = {}
) {
  const dir: OrderDir = order === 'asc' ? 'asc' : 'desc';
  const bySafe: OrderBy = by === 'number' ? 'number' : 'created_at';

  const orderBy =
    bySafe === 'number'
      ? `coalesce(chapter_number,0) ${dir}, created_at desc`
      : `created_at ${dir}, coalesce(chapter_number,0) desc`;

  const params: any[] = [mangaId];
  const lim = Math.max(0, Math.floor(limit));
  const limitSql = lim ? ` limit $${params.push(lim)}` : '';

  // ✅ Используем vol_number (как в таблице) + проверяем review_status
  const sql = `
    select 
      id, 
      manga_id, 
      coalesce(chapter_number,0) as chapter_number,
      vol_number,
      vol_number as volume_index,
      coalesce(title,'') as title,
      status,
      review_status,
      pages_count, 
      created_at, 
      updated_at
    from chapters
    where manga_id = $1
      and (
        lower(coalesce(status,'')) = 'published' 
        or lower(coalesce(review_status,'')) = 'published'
      )
    order by ${orderBy}${limitSql}`;

  try {
    const { rows } = await query(sql, params);
    return rows;
  } catch (e: any) {
    console.error('[getPublicChaptersByManga] Error:', e);
    throw e;
  }
}