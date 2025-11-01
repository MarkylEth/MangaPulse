// app/api/news/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { requireUser } from '@/lib/auth/route-guards';

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
  comment_count: number;
};

function isStaff(u: any): boolean {
  const role = String(u?.role ?? '').toLowerCase();
  return role === 'admin' || role === 'moderator';
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(50, Number(searchParams.get('limit') ?? '12')) || 12;

    const rows = await sql`
      select
        n.id, n.title, n.body, n.pinned, n.visible, n.created_at, n.author_id,
        coalesce(p.display_name, u.username) as author_name,
        p.avatar_url as author_avatar,
        p.role as author_role,
        (select count(*)::int from news_comments nc where nc.news_id = n.id) as comment_count
      from news n
      left join users u on u.id = n.author_id
      left join profiles p on p.user_id = n.author_id
      where n.visible = true
      order by n.pinned desc, n.created_at desc
      limit ${limit}
    `;
    
    return NextResponse.json({ data: rows as Row[] }, { status: 200 });
  } catch (e) {
    console.error('GET /api/news error', e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const u = await requireUser();
    if (!isStaff(u)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

    const json = await req.json().catch(() => ({}));
    const title = String(json?.title ?? '').trim();
    const body = String(json?.body ?? '').trim();
    const pinned = Boolean(json?.pinned);

    if (title.length < 2 || body.length < 1) {
      return NextResponse.json({ error: 'validation' }, { status: 400 });
    }

    const authorId = u.id;
    if (!authorId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const rows = await sql`
      insert into news (title, body, pinned, visible, author_id)
      values (${title}, ${body}, ${pinned}, true, ${authorId})
      returning id
    `;
    
    const insertedId = (rows[0] as { id: number } | undefined)?.id ?? null;
    return NextResponse.json({ ok: true, data: { id: insertedId } }, { status: 201 });
  } catch (e) {
    console.error('POST /api/news error', e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}