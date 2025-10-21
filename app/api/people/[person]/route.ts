import { neon } from '@neondatabase/serverless';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const sql = neon(process.env.DATABASE_URL!);

// Универсальный поиск id по id/handle/slug/имени (в т.ч. slugified)
async function resolvePersonId(keyRaw: string): Promise<number | null> {
  const key = decodeURIComponent(keyRaw || '').trim();
  if (!key) return null;

  if (/^\d+$/.test(key)) {
    const r: any[] = await sql`select id from people where id = ${Number(key)} limit 1`;
    return r.length ? Number(r[0].id) : null;
  }

  const keySlug = key.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const triesExact = [
    sql`select id from people where lower(handle)      = lower(${key}) limit 1`,
    sql`select id from people where lower(slug)        = lower(${key}) limit 1`,
    sql`select id from people where lower(username)    = lower(${key}) limit 1`,
    sql`select id from people where lower(nickname)    = lower(${key}) limit 1`,
    sql`select id from people where lower(full_name)   = lower(${key}) limit 1`,
    sql`select id from people where lower(display_name)= lower(${key}) limit 1`,
    sql`select id from people where lower(name)        = lower(${key}) limit 1`,
  ];

  for (const q of triesExact) {
    try { const r: any[] = await q as any; if (r?.length) return Number(r[0].id); } catch {}
  }

  const triesSlugified = [
    sql`select id from people where regexp_replace(lower(coalesce(slug,'')),        '[^a-z0-9]+','-','g') = ${keySlug} limit 1`,
    sql`select id from people where regexp_replace(lower(coalesce(name,'')),        '[^a-z0-9]+','-','g') = ${keySlug} limit 1`,
    sql`select id from people where regexp_replace(lower(coalesce(full_name,'')),   '[^a-z0-9]+','-','g') = ${keySlug} limit 1`,
    sql`select id from people where regexp_replace(lower(coalesce(display_name,'')),'[^a-z0-9]+','-','g') = ${keySlug} limit 1`,
  ];

  for (const q of triesSlugified) {
    try { const r: any[] = await q as any; if (r?.length) return Number(r[0].id); } catch {}
  }

  return null;
}

export async function GET(_req: Request, { params }: { params: { person: string } }) {
  try {
    const key = params.person ?? '';
    const id = await resolvePersonId(key);
    if (!id) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

    // ⚠️ Безопасный SELECT: все поля через to_jsonb(p)->>'...'
    const rows: any[] = await sql`
      select
        p.id                                            as id,
        to_jsonb(p)->>'handle'        as handle,
        to_jsonb(p)->>'slug'          as slug,
        coalesce(
          to_jsonb(p)->>'full_name',
          to_jsonb(p)->>'display_name',
          to_jsonb(p)->>'nickname',
          to_jsonb(p)->>'username',
          to_jsonb(p)->>'name',
          to_jsonb(p)->>'handle',
          to_jsonb(p)->>'slug'
        )                              as name,
        coalesce(
          to_jsonb(p)->>'avatar_url',
          to_jsonb(p)->>'logo_url',
          to_jsonb(p)->>'photo_url',
          to_jsonb(p)->>'image_url'
        )                              as avatar_url
      from people p
      where p.id = ${id}
      limit 1
    `;

    if (!rows?.length) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

    const p = rows[0];
    return Response.json({
      ok: true,
      data: {
        creator: {
          id: p.id,
          handle: p.handle ?? p.slug ?? null,
          name: p.name ?? 'Unknown',
          avatar_url: p.avatar_url ?? null,
        },
      },
    });
  } catch (e) {
    console.error('[people/:person] error', e);
    return Response.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
