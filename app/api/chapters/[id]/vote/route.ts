import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function bad(msg: string, code = 400) { return NextResponse.json({ ok:false, error: msg }, { status: code }); }

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const chapterId = Number(params.id || 0);
    const { user_id } = await req.json().catch(() => ({}));
    if (!chapterId) return bad('chapterId');
    if (!user_id) return bad('user_id');
    await query(
      `insert into chapter_likes(chapter_id, user_id) values($1,$2)
       on conflict (chapter_id, user_id) do nothing`,
      [chapterId, user_id]
    );
    const { rows } = await query<{ cnt: number }>(
      `select count(*)::int as cnt from chapter_likes where chapter_id=$1`, [chapterId]
    );
    return NextResponse.json({ ok: true, likes: rows?.[0]?.cnt ?? 0, likedByMe: true });
  } catch (e: any) {
    return bad(e?.message || 'vote failed', 500);
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const chapterId = Number(params.id || 0);
    const { user_id } = await req.json().catch(() => ({}));
    if (!chapterId) return bad('chapterId');
    if (!user_id) return bad('user_id');
    await query(`delete from chapter_likes where chapter_id=$1 and user_id=$2`, [chapterId, user_id]);
    const { rows } = await query<{ cnt: number }>(
      `select count(*)::int as cnt from chapter_likes where chapter_id=$1`, [chapterId]
    );
    return NextResponse.json({ ok: true, likes: rows?.[0]?.cnt ?? 0, likedByMe: false });
  } catch (e: any) {
    return bad(e?.message || 'unvote failed', 500);
  }
}
