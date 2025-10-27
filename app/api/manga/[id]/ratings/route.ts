// app/api/manga/[id]/ratings/route.ts
import { NextResponse } from 'next/server';
import { getSessionToken, verifySession } from '@/lib/auth/session';
import { query, queryAsUser } from '@/lib/db';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function toInt(v: string | number | null | undefined) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
}

/* ========= GET: список оценок для тайтла (публично) ========= */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const mangaId = toInt(params.id);
    if (!Number.isFinite(mangaId)) {
      return NextResponse.json({ ok: false, message: 'Bad id' }, { status: 400 });
    }

    const { rows } = await query<{
      id: string;
      manga_id: number;
      user_id: string;
      rating: number;
      created_at: string;
      updated_at: string | null;
    }>(
      `SELECT id, manga_id, user_id, rating, created_at, updated_at
         FROM public.manga_ratings
        WHERE manga_id = $1
        ORDER BY created_at ASC`,
      [mangaId]
    );

    return NextResponse.json(
      { ok: true, items: rows },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
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

    // auth (единый способ)
    const token = await getSessionToken();
    const sess = await verifySession(token);
    if (!sess) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const rating = Number(body?.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 10) {
      return NextResponse.json({ ok: false, message: 'Rating must be 1..10' }, { status: 422 });
    }

    // Важно: писать под контекстом пользователя (RLS)
    const { rows } = await queryAsUser<{
      id: string;
      manga_id: number;
      user_id: string;
      rating: number;
      created_at: string;
      updated_at: string | null;
    }>(
      `
      INSERT INTO public.manga_ratings (manga_id, user_id, rating)
      VALUES ($1, $2::uuid, $3)
      ON CONFLICT (manga_id, user_id)
      DO UPDATE SET rating = EXCLUDED.rating, updated_at = NOW()
      RETURNING id, manga_id, user_id, rating, created_at, updated_at
      `,
      [mangaId, sess.sub, rating],
      sess.sub
    );

    return NextResponse.json(
      { ok: true, item: rows[0] },
      { status: 200, headers: { 'Cache-Control': 'no-store', Vary: 'Cookie' } }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || 'Internal error' }, { status: 500 });
  }
}

