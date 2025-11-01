// app/api/manga/[id]/view/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

// 12 часов
const VIEW_TTL_MS = 12 * 60 * 60 * 1000;

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const mangaId = Number(params.id);
    if (!Number.isFinite(mangaId) || mangaId <= 0) {
      return NextResponse.json({ ok: false, message: 'Invalid manga ID' }, { status: 400 });
    }

    const store = await cookies();
    const key = `manga_view_${mangaId}`;
    const now = Date.now();
    const last = Number(store.get(key)?.value ?? NaN);
    const shouldCount = Number.isNaN(last) || (now - last) >= VIEW_TTL_MS;

    // текущее значение
    const sel = await query<{ views: number }>(
      `select coalesce(views, view_count, 0)::int as views
         from manga
        where id = $1
        limit 1`,
      [mangaId]
    );
    if (!sel.rows?.length) {
      return NextResponse.json({ ok: false, message: 'Manga not found' }, { status: 404 });
    }
    let views = Number(sel.rows[0].views || 0);

    if (!shouldCount) {
      // НЕ обновляем cookie — окно фиксированное
      return NextResponse.json({ ok: true, counted: false, views });
    }

    // инкремент (поддержка старого поля view_count)
    const upd = await query<{ views: number }>(
      `update manga
          set views = coalesce(views, view_count, 0) + 1
        where id = $1
      returning views::int`,
      [mangaId]
    );
    views = Number(upd.rows?.[0]?.views ?? views + 1);

    const resp = NextResponse.json({ ok: true, counted: true, views });
    resp.cookies.set(key, String(now), {
      maxAge: Math.floor(VIEW_TTL_MS / 1000),
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    });
    return resp;
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? 'Internal error' }, { status: 500 });
  }
}

// GET для дебага
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const mangaId = Number(params.id);
  if (!Number.isFinite(mangaId) || mangaId <= 0) {
    return NextResponse.json({ ok: false, message: 'Invalid manga ID' }, { status: 400 });
  }

  const r = await query<{ id: number; title: string; views: number }>(
    `select id, title, coalesce(views, view_count, 0)::int as views
       from manga
      where id = $1
      limit 1`,
    [mangaId]
  );
  if (!r.rows?.length) {
    return NextResponse.json({ ok: false, message: 'Manga not found' }, { status: 404 });
  }

  const key = `manga_view_${mangaId}`;
  const c = await cookies();
  const last = Number(c.get(key)?.value ?? NaN);
  const ageMs = Number.isNaN(last) ? null : Date.now() - last;
  const shouldCount = ageMs == null || ageMs >= VIEW_TTL_MS;

  return NextResponse.json({
    ok: true,
    manga: r.rows[0],
    debug: { last, ageMs, shouldCount, ttlMs: VIEW_TTL_MS },
  });
}
