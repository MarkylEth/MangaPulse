// app/api/manga/[id]/bundle/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth/route-guards';
import { getLeaderTeamIdForTitle } from '@/lib/team/leader';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    translation_status: row.translation_status ?? null,
    age_rating: row.age_rating ?? null,
    release_year: row.release_year ?? null,
    rating: row.rating ?? null,
    rating_count: row.rating_count ?? null,
    original_title: row.original_title ?? null,
    title_romaji: row.title_romaji ?? null,
    type: row.type ?? null,
    release_formats: ensureStrArr(row.release_formats),
    tags: ensureStrArr(row.tags),
    genres: ensureStrArr(row.genres),
    slug: row.slug ?? null,
  } as any;
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
      `select * from manga
       where lower(coalesce(slug,'')) = $1
          or regexp_replace(lower(coalesce(title_romaji,'')), '[^a-z0-9]+','-','g') = $1
          or regexp_replace(lower(coalesce(original_title,'')), '[^a-z0-9]+','-','g') = $1
       limit 1`,
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
    vol_number: row.vol_number == null ? (row.volume_number == null ? null : Number(row.volume_number)) : Number(row.vol_number),
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

type Ctx = { params: Promise<{ id: string }> } | { params: { id: string } };

export async function GET(req: NextRequest, ctx: any) {
  const params = 'then' in ctx.params ? await ctx.params : ctx.params;
  const id = params.id as string;

  try {
    const found = await findMangaRow(id);
    if (!found) {
      const meTmp = await getAuthUser(req).catch(() => null);
      return NextResponse.json(
        { 
          ok: true, 
          item: null, 
          me: meTmp ? { 
            id: meTmp.id, 
            username: meTmp.username ?? null, 
            role: meTmp.role ?? 'user', 
            leaderTeamId: null 
          } : null 
        },
        { status: 200, headers: { 'Cache-Control': 'private, max-age=30' } }
      );
    }

    const mangaId = found.id as number;

    // Параллельная загрузка ВСЕХ данных
    const [me, teams, chapters, people, publishers, ratingsData, bookmarkData] = await Promise.all([
      getAuthUser(req).catch(() => null),
      
      // Teams
      query(
        `select t.id, t.name, t.slug, t.avatar_url, t.verified
         from translator_team_manga tm
         join translator_teams t on t.id = tm.team_id
         where tm.manga_id = $1
         order by t.name asc`,
        [mangaId]
      ).then(r => r.rows || []).catch(() => []),
      
      // Chapters
      query(
        `select c.id, c.manga_id, c.chapter_number, c.title, c.created_at, c.published_at, 
                c.updated_at, c.status, c.review_status, c.vol_number, c.volume_number, 
                c.uploaded_by, p.username as uploader_username, p.avatar_url as uploader_avatar
         from chapters c
         left join profiles p on p.id = c.uploaded_by
         where c.manga_id = $1
           and (c.review_status = 'published' or c.status = 'published')
         order by c.created_at desc`,
        [mangaId]
      ).then(r => (r.rows || []).map(normalizeChapter)).catch(() => []),
      
      // People (authors & artists)
      query(
        `select p.id, p.name, p.slug, mp.role::text as role
         from manga_people mp
         join people p on p.id = mp.person_id
         where mp.manga_id = $1
         order by mp.assigned_at asc, p.name asc`,
        [mangaId]
      ).then(r => {
        const authors: any[] = [];
        const artists: any[] = [];
        for (const row of r.rows || []) {
          const item = { id: Number(row.id), name: row.name, slug: row.slug ?? null };
          if (row.role === 'author') authors.push(item);
          else if (row.role === 'artist') artists.push(item);
        }
        return { authors, artists };
      }).catch(() => ({ authors: [], artists: [] })),
      
      // Publishers
      query(
        `select pb.id, pb.name, pb.slug
         from manga_publishers mp
         join publishers pb on pb.id = mp.publisher_id
         where mp.manga_id = $1
         order by mp.assigned_at asc, pb.name asc`,
        [mangaId]
      ).then(r => (r.rows || []).map((row: any) => ({
        id: Number(row.id),
        name: row.name,
        slug: row.slug ?? null,
      }))).catch(() => []),
      
      // Ratings (все данные сразу)
      query(
        `select id, manga_id, rating, user_id, created_at, updated_at
         from manga_ratings 
         where manga_id = $1
         order by created_at asc`,
        [mangaId]
      ).then(async (r) => {
        const ratings = r.rows || [];
        const aggRes = await query(
          `select count(*)::int as count, coalesce(avg(rating),0)::float as avg 
           from manga_ratings 
           where manga_id = $1`,
          [mangaId]
        );
        return {
          ratings,
          ratings_count: Number(aggRes.rows?.[0]?.count || 0),
          ratings_avg: Number(aggRes.rows?.[0]?.avg || 0),
        };
      }).catch(() => ({ ratings: [], ratings_count: 0, ratings_avg: 0 })),
      
      // Bookmark (только если юзер залогинен)
      (async () => {
        const user = await getAuthUser(req).catch(() => null);
        if (!user?.id) return null;
        
        const r = await query(
          `select chapter_id, page 
           from reader_bookmarks 
           where user_id = $1 and manga_id = $2 
           limit 1`,
          [user.id, mangaId]
        ).catch(() => ({ rows: [] }));
        
        return r.rows?.[0] ?? null;
      })(),
    ]);

    // Leader team ID
    let leaderTeamId: number | null = null;
    if (me?.id) {
      try {
        leaderTeamId = await getLeaderTeamIdForTitle(me.id, mangaId);
      } catch { 
        leaderTeamId = null; 
      }
    }

    const meLite = me
      ? { 
          id: me.id, 
          username: me.username ?? null, 
          role: me.role ?? 'user', 
          leaderTeamId 
        }
      : null;

    const item = normalizeManga(found);

    return NextResponse.json(
      {
        ok: true,
        item,
        teams,
        chapters,
        tags: item.tags || [],
        genres: item.genres || [],
        ratings: ratingsData.ratings,
        ratings_avg: ratingsData.ratings_avg,
        ratings_count: ratingsData.ratings_count,
        people,
        publishers,
        bookmark: bookmarkData,
        me: meLite,
      },
      { 
        status: 200, 
        headers: { 
          'Cache-Control': 'private, max-age=60',
          'X-Content-Type-Options': 'nosniff'
        } 
      }
    );
  } catch (e: any) {
    console.error('[bundle] Error:', e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'Internal error' }, 
      { status: 500 }
    );
  }
}