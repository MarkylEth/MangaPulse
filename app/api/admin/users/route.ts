import { NextRequest, NextResponse } from 'next/server';
import { query, queryAsUser } from '@/lib/db';
import { requireAdmin } from '@/lib/admin/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Role = 'admin' | 'moderator' | 'user';
function normalizeRole(r: unknown): Role {
  return r === 'admin' || r === 'moderator' ? r : 'user';
}

export async function GET(req: NextRequest) {
  const { userId } = await requireAdmin();

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim().toLowerCase();
  const roleParam = searchParams.get('role');
  const roleFilter: Role | null =
    roleParam === 'admin' || roleParam === 'moderator' || roleParam === 'user'
      ? (roleParam as Role)
      : null;

  const params: any[] = [];
  let where = '1=1';

  if (q) {
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    where += ` AND (
      COALESCE(p.username,'') ILIKE $${params.length - 3}
      OR COALESCE(p.full_name,'') ILIKE $${params.length - 2}
      OR COALESCE(u.email,'') ILIKE $${params.length - 1}
      OR p.id::text ILIKE $${params.length}
    )`;
  }
  if (roleFilter) {
    params.push(roleFilter);
    where += ` AND p.role = $${params.length}`;
  }

  const sql = `
    SELECT
      p.id::text AS id,
      COALESCE(p.username, u.username) AS username,
      COALESCE(p.full_name, u.full_name) AS full_name,
      p.role AS role,
      p.banned AS banned,
      COALESCE(p.avatar_url, u.avatar) AS avatar_url,
      u.email AS email,
      p.note AS note,
      COALESCE(p.created_at, u.created_at, NOW()) AS created_at
    FROM public.profiles p
    LEFT JOIN public.users u ON u.id = p.id
    WHERE ${where}
    ORDER BY created_at DESC
    LIMIT 500
  `;

  const { rows } = await queryAsUser(sql, params, userId);
  return NextResponse.json(
    { ok: true, items: rows },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(req: NextRequest) {
  const { userId } = await requireAdmin();

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const id = String(body?.id || '').trim();
  const role = normalizeRole(body?.role);

  if (!id) {
    return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 });
  }

  const { rowCount } = await queryAsUser(
    `UPDATE public.profiles SET role = $1, updated_at = NOW() WHERE id::text = $2`,
    [role, id],
    userId
  );

  if (!rowCount) {
    return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const { userId } = await requireAdmin();

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const id = String(body?.id || '').trim();
  const banned = Boolean(body?.banned);
  const reason = String(body?.reason || '').trim();

  if (!id) {
    return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 });
  }

  const noteUpdate = banned && reason ? `, note = CONCAT(COALESCE(note, ''), '\n[БАН] ', $3, ' (', NOW(), ')')` : '';
  const queryParams = banned && reason ? [banned, id, reason] : [banned, id];

  const { rowCount } = await queryAsUser(
    `UPDATE public.profiles SET banned = $1, updated_at = NOW()${noteUpdate} WHERE id::text = $2`,
    queryParams,
    userId
  );

  if (!rowCount) {
    return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}