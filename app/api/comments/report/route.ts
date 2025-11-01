// app/api/comments/report/route.ts
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
export const dynamic = "force-dynamic";

/* ========= types & helpers ========= */
type Row = Record<string, any>;
type SqlFn = <T = Row>(q: TemplateStringsArray, ...vals: any[]) => Promise<T[]>;
type Source = "manga" | "page" | "post";

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

async function getUserId(): Promise<string | null> {
  const u = await getSessionUser();
  return u?.id ?? null;
}

const REASONS: Record<string, true> = {
  spam: true,
  offtopic: true,
  insult: true,
  spoiler: true,
  nsfw: true,
  illegal: true,
  other: true,
};

const isUUID = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );

/* ========= route ========= */
export async function POST(req: Request) {
  try {
    const sql = await getSql();
    if (!sql)
      return NextResponse.json(
        { ok: false, message: "DB not configured" },
        { status: 500 }
      );

    const body = await req.json().catch(() => ({}));
    const source = String(body?.source || "manga").toLowerCase() as Source;
    const commentId = String(body?.commentId || "");
    const reason = String(body?.reason || "").toLowerCase();
    let details = String(body?.details || "").trim();

    const me = await getUserId();
    if (!me)
      return NextResponse.json(
        { ok: false, message: "unauthorized" },
        { status: 401 }
      );

    if (!["manga", "page", "post"].includes(source))
      return NextResponse.json(
        { ok: false, message: "bad source" },
        { status: 400 }
      );
    if (!isUUID(commentId))
      return NextResponse.json(
        { ok: false, message: "bad commentId" },
        { status: 400 }
      );
    if (!REASONS[reason])
      return NextResponse.json(
        { ok: false, message: "bad reason" },
        { status: 400 }
      );
    if (details.length > 500) details = details.slice(0, 500);

    // ----- rate limit по пользователю -----
    const rate = await sql<{ cnt: string }>`
      SELECT COUNT(*)::int AS cnt
      FROM public.comment_reports
      WHERE user_id = ${me} AND created_at > now() - interval '5 minutes'
    `;
    const cnt = Number(rate?.[0]?.cnt ?? 0);
    if (cnt >= 5) {
      return NextResponse.json(
        { ok: false, message: "too many reports, try later" },
        { status: 429 }
      );
    }

    // ----- проверим, что комментарий существует и это не свой -----
    let ownerId: string | null = null;

    if (source === "manga") {
      const rows = await sql<{ user_id: string | null }>`
        SELECT user_id FROM public.manga_comments WHERE id = ${commentId}::uuid
      `;
      if (!rows.length)
        return NextResponse.json(
          { ok: false, message: "comment not found" },
          { status: 404 }
        );
      ownerId = rows[0].user_id ?? null;
    } else if (source === "page") {
      const rows = await sql<{ user_id: string | null }>`
        SELECT user_id FROM public.page_comments WHERE id = ${commentId}::uuid
      `;
      if (!rows.length)
        return NextResponse.json(
          { ok: false, message: "comment not found" },
          { status: 404 }
        );
      ownerId = rows[0].user_id ?? null;
    } else {
      const rows = await sql<{ user_id: string | null }>`
        SELECT user_id FROM public.team_post_comments WHERE id = ${commentId}::uuid
      `;
      if (!rows.length)
        return NextResponse.json(
          { ok: false, message: "comment not found" },
          { status: 404 }
        );
      ownerId = rows[0].user_id ?? null;
    }

    if (ownerId && ownerId === me) {
      return NextResponse.json(
        { ok: false, message: "cannot report own comment" },
        { status: 400 }
      );
    }

    // ----- вставляем жалобу -----
    try {
      await sql`
        INSERT INTO public.comment_reports (source, comment_id, user_id, reason, details, status, created_at)
        VALUES (${source}, ${commentId}::uuid, ${me}::uuid, ${reason}, NULLIF(${details}, ''), 'open', now())
      `;
    } catch (e: any) {
      // 23505 — уникальный конфликт (например, (comment_id, user_id))
      if (e?.code === "23505") {
        return NextResponse.json({ ok: true, message: "already reported" });
      }
      throw e;
    }

    // ----- аккуратно увеличим reports_count, если колонка есть -----
    try {
      if (source === "manga") {
        await sql`
          UPDATE public.manga_comments
          SET reports_count = COALESCE(reports_count, 0) + 1
          WHERE id = ${commentId}::uuid
        `;
      } else if (source === "page") {
        await sql`
          UPDATE public.page_comments
          SET reports_count = COALESCE(reports_count, 0) + 1
          WHERE id = ${commentId}::uuid
        `;
      } else {
        await sql`
          UPDATE public.team_post_comments
          SET reports_count = COALESCE(reports_count, 0) + 1
          WHERE id = ${commentId}::uuid
        `;
      }
    } catch (e: any) {
      // 42P01 — нет таблицы; 42703 — нет колонки. Игнорируем.
      if (e?.code !== "42P01" && e?.code !== "42703") throw e;
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[/api/comments/report] error:", e);
    return NextResponse.json(
      { ok: false, message: e?.message || "server error" },
      { status: 500 }
    );
  }
}
