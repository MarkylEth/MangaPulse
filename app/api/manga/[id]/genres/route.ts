// app/api/manga/[id]/genres/route.ts
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const mangaId = Number(params.id);
  if (!Number.isFinite(mangaId)) return NextResponse.json({ ok: false, message: 'Bad id' }, { status: 400 });

  try {
    // 1) попробуем отдельную таблицу связей
    try {
      const r = await query(
        `select mg.id, mg.manga_id, g.name as genre
           from manga_genres mg
           join genres g on g.id = mg.genre_id
          where mg.manga_id = $1
          order by g.name asc`,
        [mangaId]
      );
      return NextResponse.json({ ok: true, items: r.rows || [] });
    } catch (e: any) {
      // 42P01 — relation does not exist
      if (e?.code !== '42P01') throw e;
    }

    // 2) резерв: колонка genres в самой таблице manga
    const r2 = await query(`select genres from manga where id = $1 limit 1`, [mangaId]);
    const raw = r2.rows?.[0]?.genres ?? null;
    const arr: string[] = Array.isArray(raw)
      ? raw
      : typeof raw === 'string'
      ? raw.split(/[,\n;]+/g).map((s: string) => s.trim()).filter(Boolean)
      : [];
    return NextResponse.json({ ok: true, items: arr.map((g, i) => ({ id: `local-${i}`, manga_id: mangaId, genre: g })) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? 'Internal error' }, { status: 500 });
  }
}

