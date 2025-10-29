// app/api/manga/[id]/comments/[commentId]/vote/route.ts
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { id: string; commentId: string };
const HIDE_THRESHOLD = -15;

export async function POST(req: Request, { params }: { params: Params }) {
  try {
    const user = await requireAuth();
    const mangaId = Number(params.id);
    const commentId = String(params.commentId);

    const body = await req.json().catch(() => ({}));
    const value = Number(body?.value);
    if (![ -1, 0, 1 ].includes(value)) {
      return NextResponse.json({ message: 'Bad value' }, { status: 400 });
    }

    // коммент существует и принадлежит этому тайтлу?
    const c = await query(
      `select 1 from public.manga_comments where id = $1 and manga_id = $2 limit 1`,
      [commentId, mangaId]
    );
    if ((c.rowCount ?? 0) === 0) {
      return NextResponse.json({ message: 'Comment not found' }, { status: 404 });
    }

    // upsert голоса
    if (value === 0) {
      await query(
        `delete from public.comment_votes where comment_id = $1 and user_id = $2`,
        [commentId, user.id]
      );
    } else {
      await query(
        `
        insert into public.comment_votes (comment_id, user_id, value)
        values ($1, $2, $3)
        on conflict (comment_id, user_id)
        do update set value = excluded.value, updated_at = now()
        `,
        [commentId, user.id, value]
      );
    }

    // пересчёт суммарного score и моего голоса
    const { rows: srows } = await query<{ score: number }>(
      `select coalesce(sum(value), 0)::int as score from public.comment_votes where comment_id = $1`,
      [commentId]
    );
    const { rows: mv } = await query<{ value: number }>(
      `select coalesce(value, 0)::int as value from public.comment_votes where comment_id = $1 and user_id = $2`,
      [commentId, user.id]
    );

    const score = srows[0]?.score ?? 0;
    const my_vote = mv[0]?.value ?? 0;

    // авто-скрытие при score <= -15
    await query(
      `update public.manga_comments set is_hidden = $2, updated_at = now() where id = $1`,
      [commentId, score <= HIDE_THRESHOLD]
    );

    return NextResponse.json({ ok: true, score, my_vote });
  } catch (e) {
    console.error('[comments.vote] error:', e);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
