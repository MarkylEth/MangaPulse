// app/api/reader/bookmarks/by-manga/[manga_id]/route.ts
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/auth/route-guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function intOrNull(v: any) {
  if (v === undefined || v === null || v === '' || String(v).toLowerCase() === 'null') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * GET /api/reader/bookmarks/by-manga/:manga_id
 * Возвращает последнюю закладку пользователя по конкретной манге.
 * { ok: true, item: { manga_id, chapter_id, page } | null }
 */
export async function GET(
  _req: Request,
  ctx: { params: { manga_id: string } }
) {
  // !!! ВАЖНО: используем тот же источник userId, что и в POST/DELETE
  let userId: string | null = null;
  try {
    const u: any = await requireUser();
    userId = String(u?.id ?? u?.userId ?? u?.user?.id ?? '');
  } catch {
    userId = null;
  }

  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const mangaId = intOrNull(ctx?.params?.manga_id);
  if (!mangaId) {
    return NextResponse.json({ ok: false, error: 'manga_id is required' }, { status: 400 });
  }

  // Берём самую свежую закладку по этой манге
  const r = await query(
    `SELECT manga_id, chapter_id, page
       FROM public.user_reader_bookmarks
      WHERE user_id = $1 AND manga_id = $2
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId, mangaId]
  );

  const row = r.rows?.[0] || null;
  if (!row) {
    return NextResponse.json({ ok: true, item: null });
  }

  const item = {
    manga_id: Number(row.manga_id),
    chapter_id: Number(row.chapter_id),
    page: row.page == null ? null : Number(row.page),
  };

  return NextResponse.json({ ok: true, item });
}