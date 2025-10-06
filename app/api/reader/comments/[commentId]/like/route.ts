import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Лайкнуть комментарий */
export async function POST(
  req: Request,
  { params }: { params: { commentId: string } }
) {
  try {
    const id = String(params.commentId);
    const { user_id } = await req.json().catch(() => ({}));
    if (!user_id) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    // Атомарно: upsert лайка + инкремент счётчика только если была вставка
    await query(
      `
      WITH ins AS (
        INSERT INTO page_comment_likes (comment_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        RETURNING 1
      )
      UPDATE page_comments
      SET likes_count = likes_count + COALESCE((SELECT COUNT(*) FROM ins), 0)
      WHERE id = $1
      `,
      [id, user_id]
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'error' }, { status: 500 });
  }
}

/** Снять лайк */
export async function DELETE(
  req: Request,
  { params }: { params: { commentId: string } }
) {
  try {
    const id = String(params.commentId);
    const { user_id } = await req.json().catch(() => ({}));
    if (!user_id) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    // Атомарно: удаление лайка + декремент счётчика только если было удаление
    await query(
      `
      WITH del AS (
        DELETE FROM page_comment_likes
        WHERE comment_id = $1 AND user_id = $2
        RETURNING 1
      )
      UPDATE page_comments
      SET likes_count = GREATEST(likes_count - COALESCE((SELECT COUNT(*) FROM del), 0), 0)
      WHERE id = $1
      `,
      [id, user_id]
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'error' }, { status: 500 });
  }
}
