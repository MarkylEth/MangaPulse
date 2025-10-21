// app/api/news/[id]/route.ts
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

type Row = {
  id: number;
  title: string;
  body: string;
  pinned: boolean;
  visible: boolean;
  created_at: string;
  author_id: string;
  author_name: string | null;
  author_avatar: string | null;
};

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) {
      return Response.json({ error: 'bad_id' }, { status: 400 });
    }

    const rows = await sql<Row>`
      select
        n.id, n.title, n.body, n.pinned, n.visible, n.created_at, n.author_id,
        coalesce(p.full_name, p.display_name, p.nickname, p.username) as author_name,
        p.avatar_url as author_avatar
      from news n
      left join profiles p on p.id = n.author_id
      where n.id = ${id} and n.visible = true
      limit 1
    `;

    const item = rows[0] ?? null;
    if (!item) return Response.json({ error: 'not_found' }, { status: 404 });

    return Response.json({ data: item }, { status: 200 });
  } catch (e) {
    console.error('GET /api/news/[id] error', e);
    return Response.json({ error: 'server_error' }, { status: 500 });
  }
}
