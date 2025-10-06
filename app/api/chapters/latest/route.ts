// app/api/chapters/latest/route.ts
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

async function hasColumn(table: string, col: string) {
  const { rowCount } = await query(
    `select 1
       from information_schema.columns
      where table_schema='public' and table_name=$1 and column_name=$2
      limit 1`,
    [table, col]
  );
  return (rowCount ?? 0) > 0;
}

/**
 * GET /api/chapters/latest?limit=15
 * Возвращает последние опубликованные главы для ленты.
 * Поля: chapter_id, manga_id, manga_title, chapter_number, volume, created_at, cover_url.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const rawLimit = Number(url.searchParams.get('limit') || 0);
    const limit = rawLimit ? Math.max(1, Math.min(50, rawLimit)) : 15; // дефолт 15

    const hasStatus = await hasColumn('chapters', 'status');

    // основной запрос
    const { rows } = await query(
      `
      select
        c.id                         as chapter_id,
        c.manga_id                  as manga_id,
        coalesce(m.title, '')       as manga_title,
        coalesce(c.chapter_number,0) as chapter_number,
        coalesce(c.volume,0)        as volume,
        c.created_at                as created_at,
        coalesce(m.cover_url, null) as cover_url
      from chapters c
      join manga m on m.id = c.manga_id
      ${hasStatus ? `where lower(c.status) = 'published'` : ``}
      order by c.created_at desc, c.id desc
      limit $1
      `,
      [limit]
    );

    // именование полей такое же, как ждёт фронт (FeedCard)
    const data = rows.map((r) => ({
      chapter_id: r.chapter_id,
      manga_id: r.manga_id,
      manga_title: r.manga_title,
      chapter_number: r.chapter_number,
      volume: r.volume,
      created_at: r.created_at,
      cover_url: r.cover_url,
      team_name: null,
      team_slug: null,
    }));

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
