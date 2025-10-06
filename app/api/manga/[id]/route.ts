// app/api/manga/[id]/route.ts
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function ensureStrArr(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === 'string') {
    const s = v.trim();
    if (s.startsWith('[')) {
      try { const a = JSON.parse(s); if (Array.isArray(a)) return a.map((x)=>String(x).trim()).filter(Boolean); } catch {}
    }
    return s.split(/[,\n;]+/g).map((x)=>x.trim()).filter(Boolean);
  }
  return [];
}
function normalize(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title ?? row.title_ru ?? row.name ?? row.original_title ?? 'Без названия',
    cover_url: row.cover_url ?? row.cover ?? null,
    author: row.author ?? null,
    artist: row.artist ?? null,
    description: row.description ?? null,
    status: row.status ?? null,
    release_year: row.release_year ?? null,
    rating: row.rating ?? null,
    rating_count: row.rating_count ?? null,
    original_title: row.original_title ?? null,
    title_romaji: row.title_romaji ?? null,
    tags: row.tags ?? null,
    genres: ensureStrArr(row.genres),
  } as any;
}
async function getTranslatorTeams(mangaId: number) {
  try {
    const res = await query(
      `select t.id, t.name, t.slug, t.avatar_url, t.verified
         from translator_team_manga tm
         join translator_teams t on t.id = tm.team_id
        where tm.manga_id = $1 order by t.name asc`,
      [mangaId]
    );
    return Array.isArray(res.rows) ? res.rows : [];
  } catch { return []; }
}
async function getItemById(id: number) {
  const r = await query(`select * from manga where id = $1 limit 1`, [id]);
  const row = r.rows?.[0];
  if (!row) return null;
  const item: any = normalize(row);
  item.translator_teams = await getTranslatorTeams(row.id);
  return item;
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const raw = String(id ?? '');

  const idMatch = raw.match(/^\d+/);
  const numericId = idMatch ? parseInt(idMatch[0], 10) : Number.NaN;
  const slug = raw.replace(/^\d+-?/, '').trim().toLowerCase();

  try {
    if (Number.isFinite(numericId)) {
      const item = await getItemById(numericId);
      if (item) return NextResponse.json({ ok: true, item }, { headers: { 'Cache-Control': 'public, max-age=30' } });
    }
    if (slug) {
      const r2 = await query(
        `select * from manga
          where lower(coalesce(slug,'')) = $1
             or regexp_replace(lower(coalesce(title_romaji,'')), '[^a-z0-9]+','-','g') = $1
             or regexp_replace(lower(coalesce(original_title,'')), '[^a-z0-9]+','-','g') = $1
          limit 1`,
        [slug],
      );
      const row2 = r2.rows?.[0];
      const item2 = row2 ? await getItemById(row2.id) : null;
      return NextResponse.json({ ok: true, item: item2 ?? null }, { headers: { 'Cache-Control': 'public, max-age=30' } });
    }
    return NextResponse.json({ ok: true, item: null }, { headers: { 'Cache-Control': 'public, max-age=30' } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, item: null, error: e?.message ?? 'Internal error' }, { status: 500 });
  }
}
