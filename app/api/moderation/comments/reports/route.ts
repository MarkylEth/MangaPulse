// app/api/moderation/comments/reports/route.ts
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Row = Record<string, any>;
type SqlFn = <T = Row>(q: TemplateStringsArray, ...vals: any[]) => Promise<T[]>;

async function getSql(): Promise<SqlFn | null> {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const mod: any = await import("@neondatabase/serverless");
  const neon = mod?.neon || mod?.default?.neon;
  const raw = neon(url);
  const sql: SqlFn = async (q, ...vals) => {
    const res: any = await raw(q, ...vals);
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.rows)) return res.rows;
    const maybe = res?.results?.[0]?.rows;
    return Array.isArray(maybe) ? maybe : [];
  };
  return sql;
}

const isUUID = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

export async function GET(req: Request) {
  try {
    try { await requireRole('moderator'); }
    catch { return NextResponse.json({ ok:false, error:'FORBIDDEN' }, { status:403 }); }

    const sql = await getSql();
    if (!sql) return NextResponse.json({ ok:false, error:"DB not configured" }, { status:500 });

    const u = new URL(req.url);
    const source = String(u.searchParams.get('source') || '').toLowerCase();
    const id = String(u.searchParams.get('id') || '');
    const limit  = Math.min(100, Math.max(1, Number(u.searchParams.get('limit')  || 50)));
    const offset = Math.max(0, Number(u.searchParams.get('offset') || 0));

    if (!['manga','page','post'].includes(source))
      return NextResponse.json({ ok:false, error:'Bad source' }, { status:400 });
    if (!isUUID(id))
      return NextResponse.json({ ok:false, error:'Bad id (uuid expected)' }, { status:400 });

    const rows = await sql/* sql */`
      select
        r.id::bigint                    as id,
        r.reason::text                  as reason,
        r.details::text                 as details,
        r.status::text                  as status,
        r.created_at                    as created_at,
        r.resolved_at                   as resolved_at,
        r.user_id::text                 as user_id,
        (select coalesce(p.display_name, u.username)
           from public.users u
           left join public.profiles p on p.user_id = u.id
          where u.id = r.user_id
          limit 1)                      as user_name
      from public.comment_reports r
      where r.source = ${source} and r.comment_id = ${id}::uuid
      order by r.created_at desc
      limit ${limit} offset ${offset}
    `;

    const totalRes = await sql<{ count:number }>`
      select count(*)::int as count
      from public.comment_reports
      where source=${source} and comment_id=${id}::uuid
    `;

    return NextResponse.json({
      ok: true,
      items: rows.map(r => ({
        id: Number(r.id),
        reason: String(r.reason || ''),
        details: r.details ?? null,
        status: String(r.status || 'open'),
        created_at: r.created_at ? String(r.created_at) : null,
        resolved_at: r.resolved_at ? String(r.resolved_at) : null,
        user_id: r.user_id ?? null,
        user_name: r.user_name ?? null,
      })),
      total: Number(totalRes?.[0]?.count ?? 0),
    });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error:e?.message || 'Server error' }, { status:500 });
  }
}
