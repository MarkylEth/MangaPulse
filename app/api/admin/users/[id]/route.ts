// app/api/admin/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { queryAsUser } from '@/lib/db';
import { requireAdmin } from '@/lib/admin/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await requireAdmin();
  const id = String(params.id || '').trim();
  
  if (!id) {
    return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 });
  }

  // Полный профиль со всеми полями
  const profileSql = `
    SELECT
      p.id::text AS id,
      COALESCE(p.username, u.username) AS username,
      COALESCE(p.full_name, u.full_name) AS full_name,
      p.display_name,
      p.nickname,
      p.role,
      p.banned,
      COALESCE(p.avatar_url, u.avatar) AS avatar_url,
      p.banner_url,
      u.email,
      p.note,
      p.bio,
      p.about_md,
      p.favorite_genres,
      p.social_links,
      p.telegram,
      p.discord_url,
      p.vk_url,
      p.x_url,
      COALESCE(p.created_at, u.created_at, NOW()) AS created_at,
      p.updated_at
    FROM public.profiles p
    LEFT JOIN public.users u ON u.id = p.id
    WHERE p.id::text = $1
    LIMIT 1
  `;
  
  const prof = await queryAsUser(profileSql, [id], userId).then((r) => r.rows?.[0] || null);

  if (!prof) {
    return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 404 });
  }

  // Аппрувы/заявки
  let approvals: any[] = [];
  try {
    const a = await queryAsUser(
      `
      SELECT id::text, type, status, created_at, COALESCE(payload->>'title', NULL) AS title
      FROM public.title_submissions
      WHERE user_id::text = $1
      ORDER BY created_at DESC
      LIMIT 50
      `,
      [id],
      userId
    );
    approvals = a.rows ?? [];
  } catch {
    approvals = [];
  }

  // Активность
  let lastActivity: any[] = [];
  try {
    const ev = await queryAsUser(
      `
      SELECT id::text, kind, created_at AS "when", meta
      FROM public.activity_log
      WHERE user_id::text = $1
      ORDER BY created_at DESC
      LIMIT 50
      `,
      [id],
      userId
    );
    lastActivity = ev.rows ?? [];
  } catch {
    lastActivity = [];
  }

  return NextResponse.json(
    { ok: true, data: { profile: prof, approvals, lastActivity } },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}