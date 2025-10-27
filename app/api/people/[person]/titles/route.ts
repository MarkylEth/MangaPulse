//app/api/people/[person]/titles/route.ts
import { neon } from '@neondatabase/serverless';
export const dynamic = 'force-dynamic';

const sql = neon(process.env.DATABASE_URL!);

async function resolvePersonId(keyRaw: string): Promise<number | null> {
  const key = decodeURIComponent(keyRaw || '').trim();
  if (!key) return null;

  if (/^\d+$/.test(key)) {
    const r: any[] = await sql`select id from people where id = ${Number(key)} limit 1`;
    return r.length ? Number(r[0].id) : null;
  }

  const keySlug = key.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const triesExact = [
    sql`select id from people where lower(handle)       = lower(${key}) limit 1`,
    sql`select id from people where lower(slug)         = lower(${key}) limit 1`,
    sql`select id from people where lower(username)     = lower(${key}) limit 1`,
    sql`select id from people where lower(full_name)    = lower(${key}) limit 1`,
    sql`select id from people where lower(display_name) = lower(${key}) limit 1`,
    sql`select id from people where lower(name)         = lower(${key}) limit 1`,
  ];
  for (const q of triesExact) { try { const r: any[] = await q as any; if (r?.length) return Number(r[0].id); } catch {} }

  const triesSlugified = [
    sql`select id from people where regexp_replace(lower(coalesce(slug,'')),        '[^a-z0-9]+','-','g') = ${keySlug} limit 1`,
    sql`select id from people where regexp_replace(lower(coalesce(name,'')),        '[^a-z0-9]+','-','g') = ${keySlug} limit 1`,
    sql`select id from people where regexp_replace(lower(coalesce(full_name,'')),   '[^a-z0-9]+','-','g') = ${keySlug} limit 1`,
    sql`select id from people where regexp_replace(lower(coalesce(display_name,'')),'[^a-z0-9]+','-','g') = ${keySlug} limit 1`,
  ];
  for (const q of triesSlugified) { try { const r: any[] = await q as any; if (r?.length) return Number(r[0].id); } catch {} }

  return null;
}

async function selectTitles(personId: number) {
  const queries = [
    sql`
      select
        m.id                                                           as id,
        max(to_jsonb(m)->>'slug')                                      as slug,
        max(coalesce(to_jsonb(m)->>'title', to_jsonb(m)->>'name'))     as title,
        max(coalesce(to_jsonb(m)->>'cover_url', to_jsonb(m)->>'poster_url')) as cover_url,
        max(
          coalesce(
            nullif(to_jsonb(m)->>'start_year','')::int,
            nullif(to_jsonb(m)->>'year','')::int
          )
        )                                                              as year,
        array_remove(
          array_agg(distinct
            case lower(coalesce(
              to_jsonb(mp)->>'role',
              to_jsonb(mp)->>'person_role',
              to_jsonb(mp)->>'kind',
              to_jsonb(mp)->>'type'
            ))
              when 'author' then 'author'
              when 'writer' then 'author'
              when 'story' then 'author'
              when 'scenario' then 'author'
              when 'script' then 'author'
              when 'artist' then 'artist'
              when 'illustrator' then 'artist'
              when 'drawer' then 'artist'
              when 'art' then 'artist'
              when 'publisher' then 'publisher'
            else null end
          ),
          null
        )                                                              as roles
      from manga_people mp
      join manga m on m.id = mp.manga_id
      where mp.person_id = ${personId}
      group by m.id
      order by m.id desc
    `,
    sql`
      select
        m.id,
        max(to_jsonb(m)->>'slug')                                      as slug,
        max(coalesce(to_jsonb(m)->>'title', to_jsonb(m)->>'name'))     as title,
        max(coalesce(to_jsonb(m)->>'cover_url', to_jsonb(m)->>'poster_url')) as cover_url,
        max(
          coalesce(
            nullif(to_jsonb(m)->>'start_year','')::int,
            nullif(to_jsonb(m)->>'year','')::int
          )
        )                                                              as year,
        array_remove(
          array_agg(distinct
            case lower(coalesce(
              to_jsonb(mp)->>'role',
              to_jsonb(mp)->>'person_role',
              to_jsonb(mp)->>'kind',
              to_jsonb(mp)->>'type'
            ))
              when 'author' then 'author'
              when 'writer' then 'author'
              when 'story' then 'author'
              when 'scenario' then 'author'
              when 'script' then 'author'
              when 'artist' then 'artist'
              when 'illustrator' then 'artist'
              when 'drawer' then 'artist'
              when 'art' then 'artist'
              when 'publisher' then 'publisher'
            else null end
          ),
          null
        )                                                              as roles
      from manga_person mp
      join manga m on m.id = mp.manga_id
      where mp.person_id = ${personId}
      group by m.id
      order by m.id desc
    `,
    sql`
      select
        m.id,
        max(to_jsonb(m)->>'slug')                                      as slug,
        max(coalesce(to_jsonb(m)->>'title', to_jsonb(m)->>'name'))     as title,
        max(coalesce(to_jsonb(m)->>'cover_url', to_jsonb(m)->>'poster_url')) as cover_url,
        max(
          coalesce(
            nullif(to_jsonb(m)->>'start_year','')::int,
            nullif(to_jsonb(m)->>'year','')::int
          )
        )                                                              as year,
        array_remove(
          array_agg(distinct
            case lower(coalesce(
              to_jsonb(mp)->>'role',
              to_jsonb(mp)->>'person_role',
              to_jsonb(mp)->>'kind',
              to_jsonb(mp)->>'type'
            ))
              when 'author' then 'author'
              when 'writer' then 'author'
              when 'story' then 'author'
              when 'scenario' then 'author'
              when 'script' then 'author'
              when 'artist' then 'artist'
              when 'illustrator' then 'artist'
              when 'drawer' then 'artist'
              when 'art' then 'artist'
              when 'publisher' then 'publisher'
            else null end
          ),
          null
        )                                                              as roles
      from manga_creators mp
      join manga m on m.id = mp.manga_id
      where mp.person_id = ${personId}
      group by m.id
      order by m.id desc
    `,
  ];

  for (const q of queries) {
    try {
      const rows: any[] = await q as any;
      if (rows) return rows;
    } catch { /* пробуем следующий */ }
  }
  return [];
}

export async function GET(_req: Request, { params }: { params: { person: string } }) {
  try {
    const personId = await resolvePersonId(params.person ?? '');
    if (!personId) return Response.json({ ok: false, error: 'person_not_found' }, { status: 404 });

    const rows = await selectTitles(personId);
    return Response.json({ ok: true, data: rows });
  } catch (e) {
    console.error('[people/:person/titles] error', e);
    return Response.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}