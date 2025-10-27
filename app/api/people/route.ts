//app/api/people/route.ts
import { neon } from '@neondatabase/serverless';
export const dynamic = 'force-dynamic';
const sql = neon(process.env.DATABASE_URL!);

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawName = String(body?.name || '').trim();
    if (!rawName) return Response.json({ ok: false, error: 'name_required' }, { status: 400 });

    const roleIn = String(body?.role || '').toUpperCase();
    const hasRole = roleIn === 'AUTHOR' || roleIn === 'ARTIST';
    const slug = slugify(rawName);

    const found: any[] = await sql`
      select id,
             coalesce(to_jsonb(p)->>'full_name',
                      to_jsonb(p)->>'display_name',
                      to_jsonb(p)->>'username',
                      to_jsonb(p)->>'name',
                      to_jsonb(p)->>'handle',
                      to_jsonb(p)->>'slug') as name,
             to_jsonb(p)->>'slug' as slug
      from people p
      where lower(coalesce(to_jsonb(p)->>'name',''))   = lower(${rawName})
         or lower(coalesce(to_jsonb(p)->>'slug',''))   = lower(${slug})
         or lower(coalesce(to_jsonb(p)->>'handle','')) = lower(${rawName})
         or regexp_replace(lower(coalesce(to_jsonb(p)->>'name','')), '[^a-z0-9]+','-','g') = ${slug}
      limit 1
    `.catch(() => []);

    if (found?.length) {
      const r = found[0];

      if (hasRole) {
        try {
          await sql`
            update people
               set role  = coalesce(role, ${roleIn}::person_role),
                   roles = case
                     when roles is null then array[${roleIn}::person_role]
                     when not (roles @> array[${roleIn}::person_role]) then array_append(roles, ${roleIn}::person_role)
                     else roles end
             where id = ${Number(r.id)}
          `;
        } catch { /* роли необязательны */ }
      }

      return Response.json({ ok: true, item: { id: Number(r.id), name: r.name || rawName, slug: r.slug ?? slug } });
    }

    // создаём
    let inserted: any[];
    if (hasRole) {
      inserted = await sql`
        insert into people (name, slug, role, roles)
        values (${rawName}, ${slug}, ${roleIn}::person_role, array[${roleIn}::person_role])
        returning id, name, slug
      `;
    } else {
      inserted = await sql`
        insert into people (name, slug)
        values (${rawName}, ${slug})
        returning id, name, slug
      `;
    }

    const row = inserted[0];
    return Response.json(
      { ok: true, item: { id: Number(row.id), name: row.name, slug: row.slug ?? slug } },
      { status: 201 }
    );
  } catch (e) {
    console.error('[POST /api/people] error', e);
    return Response.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}