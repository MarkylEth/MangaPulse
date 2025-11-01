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
  author_role: 'admin' | 'moderator' | null; 
};

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const id = Number(params.id);
    
    if (!Number.isFinite(id)) {
      return Response.json({ error: 'bad_id' }, { status: 400 });
    }

    // ✅ Убрал generic тип
    const rows = await sql`
      select
        n.id, n.title, n.body, n.pinned, n.visible, n.created_at, n.author_id,
        coalesce(p.display_name, u.username) as author_name,
        p.avatar_url as author_avatar,
        p.role                             as author_role
      from news n
      left join users u on u.id = n.author_id
      left join profiles p on p.user_id = n.author_id
      where n.id = ${id} and n.visible = true
      limit 1
    `;

    const item = (rows[0] as Row | undefined) ?? null;
    if (!item) return Response.json({ error: 'not_found' }, { status: 404 });

    return Response.json({ data: item }, { status: 200 });
  } catch (e) {
    console.error('GET /api/news/[id] error', e);
    return Response.json({ error: 'server_error' }, { status: 500 });
  }
}