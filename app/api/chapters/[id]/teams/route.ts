// app/api/chapters/[id]/teams/route.ts
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/chapters/:id/teams
 * Возвращает список команд-переводчиков для конкретной главы.
 * Источник данных: public.chapters.team_ids (int[]).
 * НИКАКИХ фолбэков — если массив пустой, возвращаем [].
 */
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const idNum = Number(params.id);
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ ok: false, error: 'Bad chapter id' }, { status: 400 });
  }

  try {
    const ch = await query(
      `select team_ids::int[] as team_ids
         from public.chapters
        where id = $1
        limit 1`,
      [idNum],
    );

    const teamIds: number[] =
      (ch.rows?.[0]?.team_ids as number[] | null | undefined)?.filter((x) => Number.isFinite(x)) ?? [];

    if (teamIds.length === 0) {
      return NextResponse.json({ ok: true, items: [] }, { status: 200 });
    }

    const rows = await query(
      `select
         t.id::int,
         t.name::text,
         t.slug::text,
         t.avatar_url::text,
         coalesce(t.verified, false) as verified
       from public.translator_teams t
       where t.id = any($1::int[])`,
      [teamIds],
    );

    // Сохраняем порядок как в team_ids
    const byId: Record<number, any> = {};
    (rows.rows ?? []).forEach((r: any) => (byId[Number(r.id)] = r));
    const items = teamIds.map((id) => byId[id]).filter(Boolean);

    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'Failed to load chapter teams' },
      { status: 500 },
    );
  }
}

