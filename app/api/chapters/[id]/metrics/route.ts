import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const chapterId = Number(params.id || 0);
    if (!Number.isFinite(chapterId) || chapterId <= 0) {
      return NextResponse.json({ ok: true, likes: 0, likedByMe: false });
    }

    const url = new URL(req.url);
    const user = url.searchParams.get('user') || '';

    const { rows } = await query<{ cnt: number }>(
      `select count(*)::int as cnt from chapter_likes where chapter_id = $1`,
      [chapterId]
    );
    let likedByMe = false;
    if (user) {
      const r2 = await query(`select 1 from chapter_likes where chapter_id=$1 and user_id=$2 limit 1`, [chapterId, user]);
      likedByMe = (r2.rowCount ?? 0) > 0;
    }

    return NextResponse.json({ ok: true, likes: rows?.[0]?.cnt ?? 0, likedByMe });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'metrics failed' }, { status: 500 });
  }
}
