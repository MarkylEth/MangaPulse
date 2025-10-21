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
};

function isStaff(u: any): boolean {
  const role = String(u?.role ?? u?.user?.role ?? '').toLowerCase();
  const roles: string[] = Array.isArray(u?.roles ?? u?.user?.roles)
    ? (u?.roles ?? u?.user?.roles).map((x: any) => String(x).toLowerCase())
    : [];
  const flags = {
    admin: Boolean(u?.is_admin ?? u?.user?.is_admin),
    moderator: Boolean(u?.is_moderator ?? u?.user?.is_moderator),
    staff: Boolean(u?.is_staff ?? u?.user?.is_staff),
  };
  return (
    flags.admin ||
    flags.moderator ||
    flags.staff ||
    role === 'admin' ||
    role === 'moderator' ||
    roles.includes('admin') ||
    roles.includes('moderator')
  );
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(50, Number(searchParams.get('limit') ?? '12')) || 12;

    const rows = await sql<Row>`
      select
        n.id, n.title, n.body, n.pinned, n.visible, n.created_at, n.author_id,
        coalesce(p.full_name, p.display_name, p.nickname, p.username) as author_name,
        p.avatar_url as author_avatar
      from news n
      left join profiles p on p.id = n.author_id
      where n.visible = true
      order by n.pinned desc, n.created_at desc
      limit ${limit}
    `;
    return NextResponse.json({ data: rows }, { status: 200 });
  } catch (e) {
    console.error('GET /api/news error', e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const u: any = await requireUser();
    if (!isStaff(u)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

    const json = await req.json().catch(() => ({}));
    const title = String(json?.title ?? '').trim();
    const body = String(json?.body ?? '').trim(); // markdown-подобная разметка
    const pinned = Boolean(json?.pinned);

    if (title.length < 2 || body.length < 1) {
      return NextResponse.json({ error: 'validation' }, { status: 400 });
    }

    const authorId = String(u?.id ?? u?.user?.id ?? '');
    if (!authorId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const rows = await sql<{ id: number }>`
      insert into news (title, body, pinned, visible, author_id)
      values (${title}, ${body}, ${pinned}, true, ${authorId})
      returning id
    `;
    return NextResponse.json({ ok: true, data: { id: rows?.[0]?.id ?? null } }, { status: 201 });
  } catch (e) {
    console.error('POST /api/news error', e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
