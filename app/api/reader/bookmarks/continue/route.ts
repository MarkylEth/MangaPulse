import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/auth/route-guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/reader/bookmarks/continue?limit=8
 * Возвращает по одной свежей закладке на каждую мангу пользователя.
 */
export async function GET(req: Request) {
  // такой же источник userId, как в твоих /bookmarks и /by-manga
  let userId: string | null = null;
  try {
    const u: any = await requireUser();
    userId = String(u?.id ?? u?.userId ?? u?.user?.id ?? '');
  } catch { userId = null; }

  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 12), 1), 50);

  // DISTINCT ON по манге: берём самую свежую запись на каждый тайтл
  const sql = `
    SELECT DISTINCT ON (rb.manga_id)
      rb.manga_id,
      m.title          AS manga_title,
      m.cover_url      AS cover_url,
      rb.chapter_id,
      c.chapter_number AS chapter_number,
      c.vol_number     AS volume,
      rb.page          AS page,
      rb.created_at    AS created_at
    FROM public.user_reader_bookmarks rb
    JOIN public.manga m     ON m.id = rb.manga_id
    LEFT JOIN public.chapters c ON c.id = rb.chapter_id
    WHERE rb.user_id = $1::uuid
    ORDER BY rb.manga_id, rb.created_at DESC
    LIMIT $2::int
  `;

  const { rows } = await query(sql, [userId, limit]);
  return NextResponse.json({ ok: true, data: rows });
}
