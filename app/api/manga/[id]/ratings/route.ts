// app/api/manga/[id]/ratings/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySession } from '@/lib/auth/session';

/* ========= runtime / cache ========= */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ========= tiny SQL helper (Neon) ========= */
type Row = Record<string, any>;
type SqlFn = <T = Row>(q: TemplateStringsArray, ...vals: any[]) => Promise<T[]>;

async function getSql(): Promise<SqlFn> {
  const url = process.env.DATABASE_URL!;
  const mod: any = await import('@neondatabase/serverless');
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

function toInt(v: string | number | null | undefined) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
}

/* ========= GET: список оценок для тайтла ========= */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const mangaId = toInt(params.id);
    if (!Number.isFinite(mangaId)) {
      return NextResponse.json({ ok: false, message: 'Bad id' }, { status: 400 });
    }
    const sql = await getSql();
    const rows = await sql/* sql */`
      SELECT id, manga_id, user_id, rating, created_at, updated_at
      FROM public.manga_ratings
      WHERE manga_id = ${mangaId}
      ORDER BY created_at ASC
    `;
    return NextResponse.json({ ok: true, items: rows }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || 'Internal error' }, { status: 500 });
  }
}

/* ========= POST: создать/обновить мою оценку (1..10) ========= */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const mangaId = toInt(params.id);
    if (!Number.isFinite(mangaId)) {
      return NextResponse.json({ ok: false, message: 'Bad id' }, { status: 400 });
    }

    // cookies() в Next 15 — async
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value ?? null;
    const sess = await verifySession(token);
    if (!sess) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const rating = Number(body?.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 10) {
      return NextResponse.json({ ok: false, message: 'Rating must be 1..10' }, { status: 422 });
    }

    const sql = await getSql();

    // Обязательно иметь уникальный индекс:
    // CREATE UNIQUE INDEX IF NOT EXISTS uq_manga_ratings ON public.manga_ratings (manga_id, user_id);
    const [item] = await sql/* sql */`
      INSERT INTO public.manga_ratings (manga_id, user_id, rating)
      VALUES (${mangaId}, ${sess.sub}, ${rating})
      ON CONFLICT (manga_id, user_id)
      DO UPDATE SET rating = EXCLUDED.rating, updated_at = NOW()
      RETURNING id, manga_id, user_id, rating, created_at, updated_at
    `;

    // (опционально) можно обновить агрегаты в таблице manga
    // await sql/* sql */`
    //   UPDATE public.manga AS m
    //   SET rating = sub.avg_rating, rating_count = sub.cnt
    //   FROM (
    //     SELECT manga_id, AVG(rating)::numeric(10,2) AS avg_rating, COUNT(*)::int AS cnt
    //     FROM public.manga_ratings
    //     WHERE manga_id = ${mangaId}
    //     GROUP BY manga_id
    //   ) AS sub
    //   WHERE m.id = sub.manga_id
    // `;

    return NextResponse.json({ ok: true, item }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || 'Internal error' }, { status: 500 });
  }
}
