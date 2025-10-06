// app/api/manga/search/route.ts
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const u = new URL(req.url);
  const q = (u.searchParams.get('q') || '').trim().slice(0, 128);
  const limit = Math.max(1, Math.min(20, Number(u.searchParams.get('limit') || 10)));
  const exclude = Number(u.searchParams.get('exclude') || 0);

  if (!q) return NextResponse.json({ ok: true, items: [] });

  try {
    const res = await query(
      `
      select id,
             coalesce(nullif(title,''), nullif(title_ru,''), nullif(original_title,''), 'Без названия') as title,
             coalesce(cover_url, poster_url, cover) as poster_url,
             slug
        from manga
       where (coalesce(title,'') ilike $1
           or coalesce(title_ru,'') ilike $1
           or coalesce(original_title,'') ilike $1
           or coalesce(slug,'') ilike $1)
         and ($2::int = 0 or id <> $2)
       order by id desc
       limit $3
      `,
      [`%${q}%`, exclude || 0, limit]
    );
    return NextResponse.json({ ok: true, items: res.rows || [] }, { headers: { 'Cache-Control': 'public, max-age=30' } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? 'Internal error' }, { status: 500 });
  }
}
