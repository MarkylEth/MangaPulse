// app/api/manga/[id]/library-stats/route.ts
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const mangaId = Number(params.id);
  if (!Number.isFinite(mangaId)) return NextResponse.json({ ok: false, message: 'Bad id' }, { status: 400 });
  try {
    const r = await query(
      `select 
          sum(case when is_favorite then 1 else 0 end)::int as favorites,
          sum(case when status = 'reading' then 1 else 0 end)::int as reading
       from user_library
       where manga_id = $1`,
      [mangaId]
    );
    const stats = r.rows?.[0] ?? { favorites: 0, reading: 0 };
    return NextResponse.json({ ok: true, stats }, { headers: { 'Cache-Control': 'public, max-age=60' } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? 'Internal error' }, { status: 500 });
  }
}
