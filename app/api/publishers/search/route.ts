import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const sql = neon(process.env.DATABASE_URL!);

function normQ(q: string) {
  return (q || '').trim().toLowerCase();
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = normQ(searchParams.get('q') ?? '');
    if (!q) return Response.json({ items: [] });

    const like = `%${q}%`;

    const rows: any[] = await sql`
      select
        p.id,
        coalesce(
          to_jsonb(p)->>'name',
          to_jsonb(p)->>'display_name',
          to_jsonb(p)->>'title',
          to_jsonb(p)->>'label',
          to_jsonb(p)->>'slug',
          'Unknown'
        ) as name,
        to_jsonb(p)->>'slug' as slug
      from publishers p
      where
        lower(coalesce(to_jsonb(p)->>'name',''))         like ${like} or
        lower(coalesce(to_jsonb(p)->>'display_name','')) like ${like} or
        lower(coalesce(to_jsonb(p)->>'title',''))        like ${like} or
        lower(coalesce(to_jsonb(p)->>'label',''))        like ${like} or
        lower(coalesce(to_jsonb(p)->>'slug',''))         like ${like}
      order by p.id desc
      limit 20
    `;

    return Response.json({
      items: rows.map(r => ({
        id: Number(r.id),
        name: r.name as string,
        slug: r.slug ?? null,
      })),
    });
  } catch (e) {
    console.error('[publishers/search] error', e);
    return Response.json({ items: [] });
  }
}
