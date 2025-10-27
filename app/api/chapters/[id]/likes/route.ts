// app/api/chapters/[id]/likes/route.ts
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const chapterId = Number(params.id || 0);
    if (!Number.isFinite(chapterId) || chapterId <= 0) {
      return NextResponse.json({ ok: true, count: 0 });
    }
    const { rows } = await query<{ cnt: number }>(
      `select count(*)::int as cnt
         from chapter_likes
        where chapter_id = $1`,
      [chapterId]
    );
    const count = rows?.[0]?.cnt ?? 0;
    return NextResponse.json({ ok: true, count });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'likes count failed' },
      { status: 500 }
    );
  }
}

