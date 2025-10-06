import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth/route-guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function jserr(e: any, status = 500) {
  return NextResponse.json(
    { ok: false, error: 'internal_error', message: e?.message, code: e?.code, detail: e?.detail },
    { status },
  );
}

function toInt(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
}

// очень простой «санитайзер»: оставляем только b/i/u/s/br/strong/em
function sanitizeHtml(input: string): string {
  // удаляем скрипты/стили/ивенты
  let html = input.replace(/<\s*\/?(script|style)[^>]*>/gi, '');
  html = html.replace(/\son\w+="[^"]*"/gi, '').replace(/\son\w+='[^']*'/gi, '');

  // разрешённые теги
  const allowed = /<\/?(b|i|u|s|br|strong|em)\s*\/?>/gi;
  // все теги -> пусто, кроме разрешённых
  html = html.replace(/<\/?[^>]+>/gi, (m) => (m.match(allowed) ? m : ''));
  return html;
}

/* ======================== GET: список ======================== */
export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const mangaId = toInt(ctx.params.id);
    if (!Number.isFinite(mangaId))
      return NextResponse.json({ ok: false, message: 'Bad id' }, { status: 400 });

    const r = await query<any>(
      `
      select
        c.*,
        p.username  as _profile_username,
        p.avatar_url as _profile_avatar
      from public.manga_comments c
      left join public.profiles p on p.id = c.user_id
      where c.manga_id = $1
      order by c.created_at asc
      `,
      [mangaId],
    );

    const items = r.rows.map((x) => ({
      id: String(x.id),
      manga_id: Number(x.manga_id),
      user_id: x.user_id ? String(x.user_id) : null,
      comment: String(x.comment ?? ''),
      created_at: String(x.created_at ?? new Date().toISOString()),
      parent_id: x.parent_id ? String(x.parent_id) : null,
      is_team_comment: typeof x.is_team_comment === 'boolean' ? x.is_team_comment : null,
      team_id: x.team_id != null ? Number(x.team_id) : null,
      is_pinned: typeof x.is_pinned === 'boolean' ? x.is_pinned : false,
      is_hidden: typeof x.is_hidden === 'boolean' ? x.is_hidden : false,
      reports_count: x.reports_count != null ? Number(x.reports_count) : 0,
      profile: {
        id: x.user_id ? String(x.user_id) : null,
        username: x._profile_username ?? null,
        avatar_url: x._profile_avatar ?? null,
      },
    }));

    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return jserr(e);
  }
}

/* ======================== POST: создать ======================== */
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const me = await getAuthUser(req);
    if (!me?.id) return NextResponse.json({ ok: false, message: 'unauthorized' }, { status: 401 });

    const mangaId = toInt(ctx.params.id);
    if (!Number.isFinite(mangaId))
      return NextResponse.json({ ok: false, message: 'Bad id' }, { status: 400 });

    const body = await req.json().catch(() => ({} as any));
    let html = String(body?.comment ?? '').trim();
    const parent_id =
      typeof body?.parent_id === 'string' && body.parent_id.length > 0 ? body.parent_id : null;

    const as_team = Boolean(body?.as_team);
    const pin = Boolean(body?.pin);

    if (!html) return NextResponse.json({ ok: false, message: 'Empty comment' }, { status: 422 });
    if (html.length > 8000)
      return NextResponse.json({ ok: false, message: 'Comment too long' }, { status: 413 });

    html = sanitizeHtml(html);

    const isTeam = as_team && me.leaderTeamId != null;
    const teamId = isTeam ? Number(me.leaderTeamId) : null;
    const wantPinned = pin && isTeam ? true : false;

    const ins = await query<any>(
      `
      insert into public.manga_comments
        (manga_id, user_id, comment, parent_id, is_team_comment, team_id, is_pinned)
      values ($1, $2::uuid, $3, $4, $5, $6, $7)
      returning *
      `,
      [mangaId, me.id, html, parent_id, isTeam, teamId, wantPinned],
    );
    const row = ins.rows?.[0];

    // подмешаем профиль
    const prof = await query<any>(
      `select username, avatar_url from public.profiles where id = $1 limit 1`,
      [me.id],
    );
    const profile = prof.rows?.[0] ?? null;

    const item = {
      id: String(row.id),
      manga_id: mangaId,
      user_id: String(me.id),
      comment: String(row.comment ?? ''),
      created_at: String(row.created_at ?? new Date().toISOString()),
      parent_id: row.parent_id ? String(row.parent_id) : null,
      is_team_comment: !!row.is_team_comment,
      team_id: row.team_id != null ? Number(row.team_id) : null,
      is_pinned: !!row.is_pinned,
      is_hidden: !!row.is_hidden,
      reports_count: row.reports_count != null ? Number(row.reports_count) : 0,
      profile: {
        id: String(me.id),
        username: profile?.username ?? null,
        avatar_url: profile?.avatar_url ?? null,
      },
    };

    return NextResponse.json({ ok: true, item }, { status: 200 });
  } catch (e: any) {
    return jserr(e);
  }
}
