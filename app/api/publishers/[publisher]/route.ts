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

export async function GET(_req: Request, { params }: { params: { publisher: string } }) {
  try {
    const id = await resolvePublisherId(params.publisher ?? '');
    if (!id) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

    const rows: any[] = await sql`
      select
        p.id as id,
        to_jsonb(p)->>'slug'  as slug,
        coalesce(
          to_jsonb(p)->>'name',
          to_jsonb(p)->>'display_name',
          to_jsonb(p)->>'title',
          to_jsonb(p)->>'label',
          to_jsonb(p)->>'slug'
        ) as name,
        coalesce(
          to_jsonb(p)->>'logo_url',
          to_jsonb(p)->>'avatar_url',
          to_jsonb(p)->>'image_url'
        ) as logo_url
      from publishers p
      where p.id = ${id}
      limit 1
    `;

    if (!rows?.length) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

    const r = rows[0];
    return Response.json({
      ok: true,
      data: {
        publisher: {
          id: Number(r.id),
          slug: r.slug ?? null,
          name: r.name ?? 'Unknown',
          logo_url: r.logo_url ?? null,
        },
      },
    });
  } catch (e) {
    console.error('[publishers/:publisher] error', e);
    return Response.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}

