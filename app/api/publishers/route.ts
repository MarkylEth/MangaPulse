import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';
const sql = neon(process.env.DATABASE_URL!);

// простая slugify как в people
function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawName = String(body?.name || '').trim();
    if (!rawName) {
      return Response.json({ ok: false, error: 'name_required' }, { status: 400 });
    }
    const slug = slugify(rawName);

    // 1) ищем существующего по name/slug/slugified(name)
    const found: any[] = await sql`
      select id,
             coalesce(
               to_jsonb(p)->>'name',
               to_jsonb(p)->>'display_name',
               to_jsonb(p)->>'title',
               to_jsonb(p)->>'label',
               to_jsonb(p)->>'slug'
             ) as name,
             to_jsonb(p)->>'slug' as slug
      from publishers p
      where lower(coalesce(to_jsonb(p)->>'name','')) = lower(${rawName})
         or lower(coalesce(to_jsonb(p)->>'slug','')) = lower(${slug})
         or regexp_replace(lower(coalesce(to_jsonb(p)->>'name','')), '[^a-z0-9]+','-','g') = ${slug}
      limit 1
    `.catch(() => []);

    if (found?.length) {
      const r = found[0];
      return Response.json({
        ok: true,
        item: { id: Number(r.id), name: r.name || rawName, slug: r.slug ?? slug },
      });
    }

    // 2) создаём запись
    const ins: any[] = await sql`
      insert into publishers (name, slug)
      values (${rawName}, ${slug})
      returning id, name, slug
    `;
    const row = ins[0];

    return Response.json(
      { ok: true, item: { id: Number(row.id), name: row.name, slug: row.slug ?? slug } },
      { status: 201 }
    );
  } catch (e) {
    console.error('[POST /api/publishers] error', e);
    return Response.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}

