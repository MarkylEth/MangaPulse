// app/api/news/[id]/comments/route.ts
import { NextRequest } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getUserIdFromRequest } from '@/lib/auth/server';

const sql = neon(process.env.DATABASE_URL!);

type CommentRow = {
  id: number;
  body: string;
  created_at: string;
  author_id: string;
  author_name: string | null;
  author_avatar: string | null;
};

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const newsId = Number(params.id);
    if (!Number.isFinite(newsId)) return Response.json({ error: 'bad_id' }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const limit = Math.min(200, Number(searchParams.get('limit') ?? '50')) || 50;

    const rows = await sql<CommentRow>`
      select
        c.id, c.body, c.created_at, c.author_id,
        coalesce(p.full_name, p.display_name, p.nickname, p.username) as author_name,
        p.avatar_url as author_avatar
      from news_comments c
      left join profiles p on p.id = c.author_id
      where c.news_id = ${newsId} 
        and c.deleted_at is null
      order by c.created_at asc, c.id asc
      limit ${limit}
    `;
    return Response.json({ data: rows }, { status: 200 });
  } catch (e) {
    console.error('GET /api/news/[id]/comments error', e);
    return Response.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const newsId = Number(params.id);
    if (!Number.isFinite(newsId)) return Response.json({ error: 'bad_id' }, { status: 400 });

    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    const bodyJson = await req.json().catch(() => ({}));
    const text = String(bodyJson?.body ?? '').trim();
    if (text.length < 1) return Response.json({ error: 'empty_body' }, { status: 400 });

    await sql`
      insert into news_comments (news_id, body, author_id)
      values (${newsId}, ${text}, ${userId})
    `;

    return Response.json({ ok: true }, { status: 201 });
  } catch (e) {
    console.error('POST /api/news/[id]/comments error', e);
    return Response.json({ error: 'server_error' }, { status: 500 });
  }
}