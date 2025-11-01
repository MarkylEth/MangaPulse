// app/api/news/[id]/comments/[commentId]/route.ts
import { NextRequest } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getAuthUser } from '@/lib/auth/route-guards';

const sql = neon(process.env.DATABASE_URL!);

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const params = await context.params;
    const newsId = Number(params.id);
    const commentId = Number(params.commentId);

    if (!Number.isFinite(newsId) || !Number.isFinite(commentId)) {
      return Response.json({ error: 'bad_id' }, { status: 400 });
    }

    const user = await getAuthUser(req);
    if (!user) {
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    // Получаем информацию о комментарии
    const comments = await sql`
      select author_id
      from news_comments
      where id = ${commentId} and news_id = ${newsId}
      limit 1
    `;

    const comment = comments[0] as { author_id: string } | undefined;
    if (!comment) {
      return Response.json({ error: 'comment_not_found' }, { status: 404 });
    }

    // Проверяем права
    const isAuthor = comment.author_id === user.id;
    const isModerator = user.role === 'admin' || user.role === 'moderator';
    
    if (!isAuthor && !isModerator) {
      return Response.json({ error: 'forbidden' }, { status: 403 });
    }

    // ЖЁСТКОЕ удаление - полностью удаляем из базы
    await sql`
      delete from news_comments
      where id = ${commentId} and news_id = ${newsId}
    `;

    return Response.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error('DELETE /api/news/[id]/comments/[commentId] error', e);
    return Response.json({ error: 'server_error' }, { status: 500 });
  }
}