// app/api/moderation/comments/whitelist/route.ts
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";

type Row = Record<string, any>;
type SqlFn = <T = Row>(q: TemplateStringsArray, ...vals: any[]) => Promise<T[]>;

async function getSql(): Promise<SqlFn> {
  const url = process.env.DATABASE_URL!;
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

const isUUID = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

async function ensureTable(sql: SqlFn) {
  await sql`
    CREATE TABLE IF NOT EXISTS public.mod_comment_overrides (
      comment_id uuid PRIMARY KEY,
      source text NOT NULL,
      is_whitelisted boolean NOT NULL DEFAULT true,
      created_by uuid,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
}

export async function GET(req: Request) {
  const sql = await getSql();
  await ensureTable(sql);

  const url = new URL(req.url);
  const idsParam = url.searchParams.getAll("ids");
  const ids = idsParam.length ? idsParam.flatMap(s => s.split(",")).filter(Boolean) : [];

  if (ids.length === 0) return NextResponse.json({ ok: true, map: {} });

  const rows = await sql<{ comment_id: string; is_whitelisted: boolean }>`
    SELECT comment_id, is_whitelisted
    FROM public.mod_comment_overrides
    WHERE comment_id = ANY(${ids}::uuid[])
  `;

  const map: Record<string, boolean> = {};
  for (const r of rows) map[r.comment_id] = !!r.is_whitelisted;

  return NextResponse.json({ ok: true, map });
}

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });

  const sql = await getSql();
  await ensureTable(sql);

  const body = await req.json().catch(() => ({} as any));
  const id = String(body?.id || "");
  const source = String(body?.source || "");
  const whitelist = Boolean(body?.whitelist);

  if (!isUUID(id)) return NextResponse.json({ ok: false, message: "bad id" }, { status: 400 });
  if (!["manga", "page", "post"].includes(source))
    return NextResponse.json({ ok: false, message: "bad source" }, { status: 400 });

  await sql`
    INSERT INTO public.mod_comment_overrides (comment_id, source, is_whitelisted, created_by)
    VALUES (${id}::uuid, ${source}, ${whitelist}, ${me.id}::uuid)
    ON CONFLICT (comment_id) DO UPDATE
      SET is_whitelisted = EXCLUDED.is_whitelisted,
          source = EXCLUDED.source,
          created_by = EXCLUDED.created_by,
          created_at = now()
  `;

  return NextResponse.json({ ok: true });
}
