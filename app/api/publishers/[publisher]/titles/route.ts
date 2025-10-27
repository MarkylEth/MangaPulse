import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';
const sql = neon(process.env.DATABASE_URL!);

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function resolvePublisherId(keyRaw: string): Promise<number | null> {
  const key = decodeURIComponent(keyRaw || '').trim();
  if (!key) return null;

  if (/^\d+$/.test(key)) {
    const r: any[] = await sql`select id from publishers where id = ${Number(key)} limit 1`;
    return r.length ? Number(r[0].id) : null;
  }

  const keySlug = slugify(key);

  const triesExact = [
    sql`select id from publishers where lower(slug)        = lower(${key}) limit 1`,
    sql`select id from publishers where lower(name)        = lower(${key}) limit 1`,
    sql`select id from publishers where lower(display_name)= lower(${key}) limit 1`,
    sql`select id from publishers where lower(title)       = lower(${key}) limit 1`,
    sql`select id from publishers where lower(label)       = lower(${key}) limit 1`,
  ];
  for (const q of triesExact) { try { const r: any[] = await q as any; if (r?.length) return Number(r[0].id); } catch {} }

  const triesSlugified = [
    sql`select id from publishers where regexp_replace(lower(coalesce(slug,'')),  '[^a-z0-9]+','-','g') = ${keySlug} limit 1`,
    sql`select id from publishers where regexp_replace(lower(coalesce(name,'')),  '[^a-z0-9]+','-','g') = ${keySlug} limit 1`,
    sql`select id from publishers where regexp_replace(lower(coalesce(title,'')), '[^a-z0-9]+','-','g') = ${keySlug} limit 1`,
  ];
  for (const q of triesSlugified) { try { const r: any[] = await q as any; if (r?.length) return Number(r[0].id); } catch {} }

  return null;
}

async function selectTitles(publisherId: number) {
  // несколько вариантов имени связующей таблицы на всякий случай
  const queries = [
    sql`
      select
        m.id as id,
        max(to_jsonb(m)->>'slug')                                  as slug,
        max(coalesce(to_jsonb(m)->>'title', to_jsonb(m)->>'name')) as title,
        max(coalesce(to_jsonb(m)->>'cover_url', to_jsonb(m)->>'poster_url')) as cover_url,
        max(
          coalesce(
            nullif(to_jsonb(m)->>'start_year','')::int,
            nullif(to_jsonb(m)->>'year','')::int
          )
        ) as year
      from manga_publishers mp
      join manga m on m.id = mp.manga_id
      where mp.publisher_id = ${publisherId}
      group by m.id
      order by m.id desc
    `,
    sql`
      select
        m.id, 
        max(to_jsonb(m)->>'slug')                                  as slug,
        max(coalesce(to_jsonb(m)->>'title', to_jsonb(m)->>'name')) as title,
        max(coalesce(to_jsonb(m)->>'cover_url', to_jsonb(m)->>'poster_url')) as cover_url,
        max(
          coalesce(
            nullif(to_jsonb(m)->>'start_year','')::int,
            nullif(to_jsonb(m)->>'year','')::int
          )
        ) as year
      from publisher_manga mp
      join manga m on m.id = mp.manga_id
      where mp.publisher_id = ${publisherId}
      group by m.id
      order by m.id desc
    `,
    sql`
      select
        m.id, 
        max(to_jsonb(m)->>'slug')                                  as slug,
        max(coalesce(to_jsonb(m)->>'title', to_jsonb(m)->>'name')) as title,
        max(coalesce(to_jsonb(m)->>'cover_url', to_jsonb(m)->>'poster_url')) as cover_url,
        max(
          coalesce(
            nullif(to_jsonb(m)->>'start_year','')::int,
            nullif(to_jsonb(m)->>'year','')::int
          )
        ) as year
      from manga_to_publishers mp
      join manga m on m.id = mp.manga_id
      where mp.publisher_id = ${publisherId}
      group by m.id
      order by m.id desc
    `,
  ];

  for (const q of queries) {
    try {
      const rows: any[] = await q as any;
      if (rows) return rows; // даже пустой массив — ок
    } catch {}
  }
  return [];
}

export async function GET(_req: Request, { params }: { params: { publisher: string } }) {
  try {
    const publisherId = await resolvePublisherId(params.publisher ?? '');
    if (!publisherId) return Response.json({ ok: false, error: 'publisher_not_found' }, { status: 404 });

    const rows = await selectTitles(publisherId);
    return Response.json({ ok: true, data: rows });
  } catch (e) {
    console.error('[publishers/:publisher/titles] error', e);
    return Response.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}

