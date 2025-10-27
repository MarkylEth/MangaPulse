import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
export const dynamic = 'force-dynamic';

/** Редактирование своего комментария */
export async function PATCH(
  req: Request,
  { params }: { params: { commentId: string } }
) {
  try {
    const id = String(params.commentId);
    const { user_id, content } = await req.json().catch(() => ({}));
    if (!user_id) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    if (!content?.trim()) return NextResponse.json({ ok: false, error: 'empty' }, { status: 400 });

    const r = await query(
      `UPDATE page_comments
         SET content = $1, is_edited = TRUE, edited_at = now()
       WHERE id = $2 AND user_id = $3
       RETURNING id`,
      [content, id, user_id]
    );
    if (r.rowCount === 0) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'error' }, { status: 500 });
  }
}

/** Удаление своего комментария (+ лайки и ответы к нему) */
export async function DELETE(
  req: Request,
  { params }: { params: { commentId: string } }
) {
  try {
    const id = String(params.commentId);
    const { user_id } = await req.json().catch(() => ({}));
    if (!user_id) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    // Удаляем лайки к удаляемой ветке и сами комментарии одной транзакцией через CTE
    const r = await query(
      `
      WITH to_del AS (
        SELECT id
        FROM page_comments
        WHERE id = $1 OR parent_id = $1
      ),
      del_likes AS (
        DELETE FROM page_comment_likes
        WHERE comment_id IN (SELECT id FROM to_del)
        RETURNING 1
      )
      DELETE FROM page_comments
      WHERE id IN (SELECT id FROM to_del) AND user_id = $2
      RETURNING id
      `,
      [id, user_id]
    );

    if (r.rowCount === 0) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'error' }, { status: 500 });
  }
}

