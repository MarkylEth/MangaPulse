// app/api/reader/bookmarks/route.ts
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

async function getUserId(): Promise<string | null> {
  try {
    const u: any = await requireUser();
    return (u?.id ?? u?.userId ?? u?.user?.id) ? String(u.id ?? u.userId ?? u.user?.id) : null;
  } catch { return null; }
}

/**
 * GET /api/reader/bookmarks
 *
 * Вариант A: ?chapter_id=123
 *   Ответ: { ok: true, has: boolean, page: number|null }
 *
 * Вариант B: ?manga_id=21
 *   Ответ: { ok: true, item: { manga_id, chapter_id, page } | null }
 */
export async function GET(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const url = new URL(req.url);
    const chapterId = intOrNull(url.searchParams.get('chapter_id'));
    const mangaId = intOrNull(url.searchParams.get('manga_id'));

    // Вариант A — старое поведение по chapter_id
    if (chapterId) {
      const r = await query(
        `SELECT page
           FROM public.user_reader_bookmarks
          WHERE user_id = $1 AND chapter_id = $2
          ORDER BY created_at DESC
          LIMIT 1`,
        [userId, chapterId]
      );

      const row = r.rows?.[0] ?? null;
      return NextResponse.json({
        ok: true,
        has: !!row,
        page: row?.page ?? null,
      });
    }

    // Вариант B — новая ветка по manga_id (последняя закладка по манге)
    if (mangaId) {
      const r = await query(
        `SELECT manga_id, chapter_id, page
           FROM public.user_reader_bookmarks
          WHERE user_id = $1 AND manga_id = $2
          ORDER BY created_at DESC
          LIMIT 1`,
        [userId, mangaId]
      );

      const row = r.rows?.[0] || null;
      const item = row
        ? {
            manga_id: Number(row.manga_id),
            chapter_id: Number(row.chapter_id),
            page: row.page == null ? null : Number(row.page),
          }
        : null;

      return NextResponse.json({ ok: true, item });
    }

    return NextResponse.json({ ok: false, error: 'chapter_id or manga_id is required' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Server error' }, { status: 500 });
  }
}

/**
 * POST /api/reader/bookmarks
 * Body: { manga_id: number, chapter_id: number, page: number }
 * Удаляет все старые закладки по манге и создаёт одну актуальную.
 */
export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const b = await req.json().catch(() => ({}));
    const mangaId = intOrNull(b?.manga_id);
    const chapterId = intOrNull(b?.chapter_id);
    const page = intOrNull(b?.page);

    if (!mangaId || !chapterId || !page) {
      return NextResponse.json({
        ok: false,
        error: 'manga_id, chapter_id and page are required',
      }, { status: 400 });
    }

    await query(
      `DELETE FROM public.user_reader_bookmarks WHERE user_id = $1 AND manga_id = $2`,
      [userId, mangaId]
    );
    await query(
      `INSERT INTO public.user_reader_bookmarks (user_id, manga_id, chapter_id, page, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [userId, mangaId, chapterId, page]
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('Error creating bookmark:', e);
    return NextResponse.json({ ok: false, error: e?.message ?? 'Server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/reader/bookmarks
 * Body или Query: { chapter_id: number }
 */
export async function DELETE(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    let b: any = {};
    try { b = await req.json(); } catch { b = {}; }

    const url = new URL(req.url);
    const chapterId = intOrNull(b?.chapter_id ?? url.searchParams.get('chapter_id'));

    if (!chapterId) {
      return NextResponse.json({ ok: false, error: 'chapter_id is required' }, { status: 400 });
    }

    await query(
      `DELETE FROM public.user_reader_bookmarks WHERE user_id = $1 AND chapter_id = $2`,
      [userId, chapterId]
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('Error deleting bookmark:', e);
    return NextResponse.json({ ok: false, error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
