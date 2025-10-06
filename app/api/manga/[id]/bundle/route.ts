// app/api/manga/[id]/bundle/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth/route-guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ========= helpers ========= */
function ensureStrArr(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return [];
    if (s.startsWith('[')) {
      try {
        const a = JSON.parse(s);
        if (Array.isArray(a)) return a.map((x) => String(x).trim()).filter(Boolean);
      } catch {}
    }
    return s.split(/[,\n;]+/g).map((x) => x.trim()).filter(Boolean);
  }
  return [];
}

function normalizeManga(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title ?? row.title_ru ?? row.name ?? row.original_title ?? 'Без названия',
    cover_url: row.cover_url ?? row.cover ?? row.poster_url ?? null,
    author: row.author ?? null,
    artist: row.artist ?? null,
    description: row.description ?? null,
    status: row.status ?? null,
    release_year: row.release_year ?? null,
    rating: row.rating ?? null,
    rating_count: row.rating_count ?? null,
    original_title: row.original_title ?? null,
    title_romaji: row.title_romaji ?? null,
    tags: ensureStrArr(row.tags),
    genres: ensureStrArr(row.genres),
    slug: row.slug ?? null,
  } as any;
}

async function getTranslatorTeams(mangaId: number) {
  try {
    const r = await query(
      `select t.id, t.name, t.slug, t.avatar_url, t.verified
         from translator_team_manga tm
         join translator_teams t on t.id = tm.team_id
        where tm.manga_id = $1
        order by t.name asc`,
      [mangaId]
    );
    return Array.isArray(r.rows) ? r.rows : [];
  } catch {
    return [];
  }
}

async function findMangaRow(rawIdOrSlug: string) {
  const idMatch = String(rawIdOrSlug ?? '').match(/^\d+/);
  const numericId = idMatch ? parseInt(idMatch[0], 10) : NaN;
  const slug = String(rawIdOrSlug ?? '').replace(/^\d+-?/, '').trim().toLowerCase();

  if (Number.isFinite(numericId)) {
    const byId = await query(`select * from manga where id = $1 limit 1`, [numericId]);
    if (byId.rows?.[0]) return byId.rows[0];
  }
  if (slug) {
    const bySlug = await query(
      `
      select * from manga
      where lower(coalesce(slug,'')) = $1
         or regexp_replace(lower(coalesce(title_romaji,'')), '[^a-z0-9]+','-','g') = $1
         or regexp_replace(lower(coalesce(original_title,'')), '[^a-z0-9]+','-','g') = $1
      limit 1
      `,
      [slug]
    );
    return bySlug.rows?.[0] ?? null;
  }
  return null;
}

function normalizeChapter(row: any) {
  const status = row.review_status ?? row.status ?? null;
  return {
    id: row.id,
    manga_id: row.manga_id,
    chapter_number: Number(row.chapter_number),
    title: row.title ?? null,
    created_at: row.created_at ?? row.published_at ?? row.updated_at ?? new Date().toISOString(),
    status,
    // номер тома: строго vol_number, но поддерживаем legacy volume_number
    vol_number:
      row.vol_number == null
        ? row.volume_number == null
          ? null
          : Number(row.volume_number)
        : Number(row.vol_number),
    uploaded_by: row.uploaded_by ?? null,
    uploader: row.uploaded_by
      ? {
          id: row.uploaded_by,
          username: row.uploader_username ?? null,
          avatar_url: row.uploader_avatar ?? null,
        }
      : null,
  };
}

async function getPublicChaptersWithVolAndUploader(mangaId: number) {
  const sql = `
    select
      c.id,
      c.manga_id,
      c.chapter_number,
      c.title,
      c.created_at,
      c.published_at,
      c.updated_at,
      c.status,
      c.review_status,
      c.vol_number,
      c.volume_number,      -- legacy
      c.uploaded_by,
      p.username as uploader_username,
      p.avatar_url as uploader_avatar
    from chapters c
    left join profiles p on p.id = c.uploaded_by
    where c.manga_id = $1
      and (c.review_status = 'published' or c.status = 'published')
    order by c.created_at desc
  `;
  const r = await query(sql, [mangaId]);
  return (r.rows || []).map(normalizeChapter);
}

/* ==== Связанные/адаптации/линки — безопасные выборки ==== */
type RelatedOut = {
  relation: string | null; // sequel | prequel | spin_off | adaptation | alt_story | ...
  target: { id?: number | string | null; title: string; cover_url?: string | null; kind?: string | null; url?: string | null };
};

async function getRelationsUnified(mangaId: number): Promise<RelatedOut[]> {
  const out: RelatedOut[] = [];

  // 1) Манга ↔ Манга (обе стороны)
  try {
    const r = await query(
      `
      select mr.relation_type as relation, m.id, m.title, m.cover_url
        from manga_relations mr
        join manga m on m.id = mr.related_manga_id
       where mr.manga_id = $1
      union all
      select mr.relation_type as relation, m2.id, m2.title, m2.cover_url
        from manga_relations mr
        join manga m2 on m2.id = mr.manga_id
       where mr.related_manga_id = $1
      `,
      [mangaId]
    );
    for (const row of r.rows || []) {
      out.push({
        relation: (row.relation || '').toString().toLowerCase(),
        target: { id: row.id, title: row.title, cover_url: row.cover_url, kind: 'manga', url: `/manga/${row.id}` },
      });
    }
  } catch {
    /* table may not exist — ignore */
  }

  // 2) Адаптации (аниме/фильмы)
  try {
    const r = await query(
      `
      select coalesce(ma.relation_type,'adaptation') as relation,
             a.id,
             coalesce(a.title, a.name) as title,
             coalesce(a.poster_url, a.cover_url) as cover_url,
             'anime' as kind
        from manga_adaptations ma
        left join anime a on a.id = ma.anime_id
       where ma.manga_id = $1
      `,
      [mangaId]
    );
    for (const row of r.rows || []) {
      out.push({
        relation: (row.relation || 'adaptation').toString().toLowerCase(),
        target: {
          id: row.id,
          title: row.title ?? 'Адаптация',
          cover_url: row.cover_url ?? null,
          kind: row.kind ?? 'anime',
          url: row.id ? `/anime/${row.id}` : null,
        },
      });
    }
  } catch {
    /* optional */
  }

  // 3) Универсальные внешние связи (если используете свою таблицу линков)
  try {
    const r = await query(
      `
      select ml.relation_type as relation,
             ml.target_title as title,
             ml.target_cover as cover_url,
             ml.kind,
             ml.url
        from manga_links ml
       where ml.manga_id = $1
       order by ml.id asc
      `,
      [mangaId]
    );
    for (const row of r.rows || []) {
      out.push({
        relation: (row.relation || null)?.toString().toLowerCase() ?? null,
        target: {
          id: null,
          title: row.title ?? 'Связанный тайтл',
          cover_url: row.cover_url ?? null,
          kind: row.kind ?? null,
          url: row.url ?? null,
        },
      });
    }
  } catch {
    /* optional */
  }

  return out;
}

/* ========= route ========= */
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;

  try {
    const me = await getAuthUser(req);
    const meLite = me
      ? { id: me.id, username: me.username ?? null, role: me.role ?? 'user', leaderTeamId: me.leaderTeamId ?? null }
      : null;

    const row = await findMangaRow(id);
    if (!row) {
      return NextResponse.json(
        { ok: true, item: null },
        { status: 200, headers: { 'Cache-Control': 'private, max-age=30' } }
      );
    }
    const item = normalizeManga(row);

    const teams = await getTranslatorTeams(row.id);
    const chapters = await getPublicChaptersWithVolAndUploader(row.id);

    const ratingsRes = await query(
      `select id, manga_id, rating, created_at, updated_at
         from manga_ratings where manga_id = $1
         order by created_at asc`,
      [row.id]
    );
    const ratings = (ratingsRes.rows || []).map(({ ...rest }) => rest);

    const aggRes = await query(
      `select count(*)::int as count, coalesce(avg(rating),0)::float as avg from manga_ratings where manga_id = $1`,
      [row.id]
    );
    const ratings_count = Number(aggRes.rows?.[0]?.count || 0);
    const ratings_avg = Number(aggRes.rows?.[0]?.avg || 0);

    // >>> НОВОЕ: связанные
    const relations = await getRelationsUnified(row.id);

    return NextResponse.json(
      {
        ok: true,
        item,
        teams,
        chapters,
        tags: item.tags || [],
        genres: item.genres || [],
        ratings,
        ratings_avg,
        ratings_count,
        relations,              // <<< добавлено
        me: meLite,
      },
      { status: 200, headers: { 'Cache-Control': 'private, max-age=60' } }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Internal error' }, { status: 500 });
  }
}
