// app/api/profile/[handle]/teams/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { handle: string } }
) {
  const handle = decodeURIComponent(params.handle || '').trim();

  if (!handle) {
    return NextResponse.json({ ok: false, error: 'missing_handle' }, { status: 400 });
  }

  try {
    // 1) Сначала получаем user_id по username
    const userResult = await query<{ id: string }>(
      `SELECT id FROM public.profiles WHERE lower(username) = lower($1) LIMIT 1`,
      [handle]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 404 });
    }

    const userId = userResult.rows[0].id;

    // 2) Получаем команды этого юзера
    const { rows } = await query<{
      team_id: number;
      role: string;
      team_name: string;
      team_slug: string | null;
      team_avatar_url: string | null;
    }>(
      `
      SELECT
        ttm.team_id,
        ttm.role,
        tt.name as team_name,
        tt.slug as team_slug,
        tt.avatar_url as team_avatar_url
      FROM translator_team_members ttm
      INNER JOIN translator_teams tt ON tt.id = ttm.team_id
      WHERE ttm.user_id = $1::uuid
      ORDER BY ttm.added_at DESC
      `,
      [userId]
    );

    // 3) Форматируем в нужную структуру
    const teams = rows.map((row) => ({
      team_id: row.team_id,
      role: row.role,
      team: {
        id: row.team_id,
        name: row.team_name,
        slug: row.team_slug,
        avatar_url: row.team_avatar_url,
      },
    }));

    return NextResponse.json({ ok: true, data: teams });
  } catch (e: any) {
    console.error('[GET /api/profile/[handle]/teams]', e);
    return NextResponse.json(
      { ok: false, error: 'internal_error', message: e?.message },
      { status: 500 }
    );
  }
}