// app/api/reader/pages/[pageId]/comments/route.ts
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
export const dynamic = 'force-dynamic';

/* ---------- helpers: безопасные выборки профилей/команд ---------- */

type UserMap = Record<string, { username?: string | null; avatar_url?: string | null }>;
type TeamMap = Record<number, { name?: string | null; avatar_url?: string | null }>;

async function fetchProfilesSafe(userIds: string[]): Promise<UserMap> {
  const out: UserMap = {};
  if (!userIds.length) return out;

  const candidates = [
    { name: 'username',      avatar: 'avatar_url' },
    { name: 'username',      avatar: 'avatar' },
    { name: 'name',          avatar: 'avatar_url' },
    { name: 'name',          avatar: 'avatar' },
    { name: 'display_name',  avatar: 'avatar_url' },
  ];

  for (const c of candidates) {
    try {
      const r = await query<{ id: string; name: string | null; av: string | null }>(
        `
        SELECT id::text AS id,
               ${c.name}   AS name,
               ${c.avatar} AS av
        FROM profiles
        WHERE id::text = ANY($1::text[])
        `,
        [userIds]
      );
      r.rows.forEach(u => { out[u.id] = { username: u.name, avatar_url: u.av }; });
      return out;
    } catch {}
  }

  try {
    const r = await query<{ id: string }>(
      `SELECT id::text AS id FROM profiles WHERE id::text = ANY($1::text[])`,
      [userIds]
    );
    r.rows.forEach(u => { out[u.id] = {}; });
  } catch {}
  return out;
}

async function fetchTeamsSafe(teamIds: number[]): Promise<TeamMap> {
  const out: TeamMap = {};
  if (!teamIds.length) return out;

  const candidates = [
    { name: 'name',         avatar: 'avatar_url' },
    { name: 'title',        avatar: 'avatar_url' },
    { name: 'display_name', avatar: 'avatar_url' },
    { name: 'name',         avatar: 'avatar' },
  ];

  for (const c of candidates) {
    try {
      const r = await query<{ id: number; name: string | null; av: string | null }>(
        `
        SELECT id,
               ${c.name}   AS name,
               ${c.avatar} AS av
        FROM teams
        WHERE id = ANY($1::int[])
        `,
        [teamIds]
      );
      r.rows.forEach(t => { out[t.id] = { name: t.name, avatar_url: t.av }; });
      return out;
    } catch {}
  }

  try {
    const r = await query<{ id: number }>(
      `SELECT id FROM teams WHERE id = ANY($1::int[])`,
      [teamIds]
    );
    r.rows.forEach(t => { out[t.id] = {}; });
  } catch {}
  return out;
}

/* ----------------------------- GET ----------------------------- */

export async function GET(
  req: Request,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { pageId: pageIdStr } = await params;
    const pageId = Number(pageIdStr);
    if (!Number.isFinite(pageId)) {
      return NextResponse.json({ ok: false, error: 'bad page id' }, { status: 400 });
    }

    const url = new URL(req.url);
    const userId = url.searchParams.get('user'); // для likedByMe

    const commentsRes = await query<{
      id: string;
      page_id: number;
      chapter_id: number | null;
      user_id: string | null;
      created_at: string;
      content: string;
      parent_id: string | null;
      is_team_comment: boolean | null;
      team_id: number | null;
      is_pinned: boolean | null;
      likes_count: number | null;
      is_edited: boolean | null;
      edited_at: string | null;
    }>(
      `
      SELECT
        id::text            AS id,
        page_id,
        chapter_id,
        user_id::text       AS user_id,
        created_at,
        content,
        parent_id::text     AS parent_id,
        is_team_comment,
        team_id,
        is_pinned,
        COALESCE(likes_count, 0) AS likes_count,
        is_edited,
        edited_at
      FROM page_comments
      WHERE page_id = $1
      ORDER BY created_at ASC
      `,
      [pageId]
    );

    const items = commentsRes.rows;

    const userIds = Array.from(new Set(items.map(c => c.user_id).filter((v): v is string => !!v)));
    const teamIds = Array.from(new Set(items.map(c => c.team_id).filter((v): v is number => v != null)));

    const [users, teams] = await Promise.all([
      fetchProfilesSafe(userIds),
      fetchTeamsSafe(teamIds),
    ]);

    let likedByMe: Record<string, boolean> = {};
    if (userId) {
      const r = await query<{ comment_id: string }>(
        `
        SELECT comment_id::text
        FROM page_comment_likes
        WHERE user_id = $1
          AND comment_id IN (SELECT id FROM page_comments WHERE page_id = $2)
        `,
        [userId, pageId]
      );
      likedByMe = Object.fromEntries(r.rows.map(x => [x.comment_id, true]));
    }

    return NextResponse.json({ ok: true, items, users, teams, likedByMe });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'error' }, { status: 500 });
  }
}

/* ----------------------------- POST ---------------------------- */

export async function POST(
  req: Request,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { pageId: pageIdStr } = await params;
    const pageId = Number(pageIdStr);
    const body = await req.json().catch(() => ({}));

    const user_id: string | undefined = body.user_id;
    const content: string | undefined = body.content;
    const parent_id: string | null =
      body.parent_id && String(body.parent_id).trim() ? String(body.parent_id) : null;
    const as_team: boolean = !!body.as_team;
    const pin: boolean = !!body.pin;

    if (!Number.isFinite(pageId)) {
      return NextResponse.json({ ok: false, error: 'bad page id' }, { status: 400 });
    }
    if (!user_id) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
    if (!content?.trim()) {
      return NextResponse.json({ ok: false, error: 'empty' }, { status: 400 });
    }

    // ВАЖНО: не трогаем chapter_id — ставим NULL, чтобы не зависеть от таблицы pages
    await query(
      `
      INSERT INTO page_comments
        (page_id, chapter_id, user_id, content, parent_id, is_team_comment, team_id, is_pinned, likes_count)
      VALUES
        ($1, NULL, $2, $3, $4, $5, NULL,
         CASE WHEN $5 THEN $6 ELSE FALSE END,
         0)
      `,
      [pageId, user_id, content, parent_id, as_team, pin]
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'error' }, { status: 500 });
  }
}

