// app/api/news/[id]/comments/[commentId]/route.ts
import { NextRequest } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getUserIdFromRequest } from '@/lib/auth/server';

const sql = neon(process.env.DATABASE_URL!);

async function isStaff(userId: string): Promise<boolean> {
  try {
    const rows = await sql<{ role: string }>`
      select role from profiles where id = ${userId} limit 1
    `;
    const role = rows[0]?.role?.toLowerCase();
    return role === 'admin' || role === 'moderator';
  } catch {
    return false;
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  try {
    const newsId = Number(params.id);
    const commentId = Number(params.commentId);

    if (!Number.isFinite(newsId) || !Number.isFinite(commentId)) {
      return Response.json({ error: 'bad_id' }, { status: 400 });
    }

    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    // Получаем информацию о комментарии
    const comments = await sql<{ author_id: string; deleted_at: string | null }>`
      select author_id, deleted_at
      from news_comments
      where id = ${commentId} and news_id = ${newsId}
      limit 1
    `;

    const comment = comments[0];
    if (!comment) {
      return Response.json({ error: 'comment_not_found' }, { status: 404 });
    }

    // Уже удален?
    if (comment.deleted_at) {
      return Response.json({ error: 'already_deleted' }, { status: 410 });
    }

    // Проверяем права
    const isAuthor = comment.author_id === userId;
    const isModerator = await isStaff(userId);
    
    if (!isAuthor && !isModerator) {
      return Response.json({ error: 'forbidden' }, { status: 403 });
    }

    // МЯГКОЕ удаление: помечаем deleted_at
    await sql`
      update news_comments
      set deleted_at = now()
      where id = ${commentId} and news_id = ${newsId}
    `;

    return Response.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error('DELETE /api/news/[id]/comments/[commentId] error', e);
    return Response.json({ error: 'server_error' }, { status: 500 });
  }
}