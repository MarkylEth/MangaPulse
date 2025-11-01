// app/api/moderation/banned/route.ts
import { NextResponse } from "next/server";
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

async function tableExists(sql: SqlFn, table: string) {
  const r = await sql/* sql */`
    select 1
    from information_schema.tables
    where table_schema='public' and table_name=${table}
    limit 1
  `;
  return r.length > 0;
}

function detectLang(req: Request): string {
  const url = new URL(req.url);
  const q = (url.searchParams.get("lang") || "").trim().toLowerCase(); // ?lang=ru
  if (q) return q;
  const al = (req.headers.get("accept-language") || "").toLowerCase();
  const m = al.match(/[a-z]{2}/);
  return m?.[0] || "any";
}

export async function GET(req: Request) {
  try {
    const sql = await getSql();
    if (!sql) return NextResponse.json({ ok: true, items: [] });

    if (!(await tableExists(sql, "mod_banned_patterns"))) {
      return NextResponse.json({ ok: true, items: [] });
    }

    const lang = detectLang(req);
    const full = (new URL(req.url)).searchParams.get("full") === "1";

    const rows = await sql/* sql */`
      select
        id::text                        as id,
        pattern::text                   as pattern,
        kind::text                      as kind,        -- 'word' | 'phrase' | 'regex' (если добавишь)
        category::text                  as category,
        lang::text                      as lang,
        severity::int                   as severity,
        is_active                       as is_active,
        created_at, updated_at
      from public.mod_banned_patterns
      where is_active = true
        and (lang = 'any' or lang = ${lang})
      order by severity desc, pattern asc
    `;

    if (full) {
      // расширенный ответ
      return NextResponse.json({
        ok: true,
        items: rows.map(r => ({
          id: r.id,
          pattern: r.pattern,
          kind: r.kind,
          category: r.category,
          lang: r.lang,
          severity: r.severity,
        })),
      });
    }

    // компактный ответ (как ждёт текущий UI: просто строки-паттерны)
    return NextResponse.json({
      ok: true,
      items: rows.map(r => String(r.pattern || "")).filter(Boolean),
    });
  } catch {
    // на любой ошибке не ломаем UI
    return NextResponse.json({ ok: true, items: [] });
  }
}
