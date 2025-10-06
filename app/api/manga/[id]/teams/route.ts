import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, getAuthUser } from '@/lib/auth/route-guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Список команд, привязанных к манге */
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const mangaId = Number(params.id || 0);
  if (!mangaId) return NextResponse.json({ ok: true, items: [] });

  const { rows } = await query(
    `select t.id, t.name, t.slug, t.avatar_url, t.verified
       from translator_team_manga tm
       join translator_teams t on t.id = tm.team_id
      where tm.manga_id = $1
      order by t.name asc`,
    [mangaId]
  );

  return NextResponse.json({ ok: true, items: rows || [] });
}

/** Лидер может привязать свою команду (или team_id из тела) */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const me = await getAuthUser(req);
  if (!me?.leaderTeamId) {
    return NextResponse.json({ ok: false, message: 'forbidden' }, { status: 403 });
  }

  const mangaId = Number(params.id || 0);
  const body = await req.json().catch(() => ({}));
  const teamId = Number(body?.team_id || me.leaderTeamId);

  if (!mangaId || !teamId) {
    return NextResponse.json({ ok: false, message: 'bad' }, { status: 400 });
  }

  // Нужен UNIQUE(team_id, manga_id) для ON CONFLICT DO NOTHING
  await query(
    `insert into translator_team_manga (team_id, manga_id)
     values ($1,$2)
     on conflict (team_id, manga_id) do nothing`,
    [teamId, mangaId]
  );

  const fresh = await query(
    `select t.id, t.name, t.slug, t.avatar_url, t.verified
       from translator_team_manga tm
       join translator_teams t on t.id = tm.team_id
      where tm.manga_id = $1
      order by t.name asc`,
    [mangaId]
  );

  return NextResponse.json({ ok: true, items: fresh.rows || [] });
}

// ⚠️ DELETE тут не нужен — используем маршрут /teams/[teamId]
