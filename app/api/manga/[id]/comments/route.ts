// app/api/manga/[id]/comments/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth/route-guards';
import { getLeaderTeamIdForTitle } from '@/lib/team/leader';
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

function b64encode(o: unknown) { return Buffer.from(JSON.stringify(o)).toString('base64url'); }
function b64decode<T = any>(s: string) { return JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as T; }

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

// длина по «чистому» тексту (для лимитов 400/1000/∞)
function plainLen(html: string): number {
  const text = String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length;
}

// приведение строки из БД к единому формату
function mapRow(x: any) {
  // нормализуем created_at → ISO 8601 (важно для курсора и ::timestamptz)
  const createdRaw = x.created_at;
  const createdISO =
    createdRaw instanceof Date
      ? createdRaw.toISOString()
      : new Date(String(createdRaw ?? Date.now())).toISOString();

  return {
    id: String(x.id),
    manga_id: Number(x.manga_id),
    user_id: x.user_id ? String(x.user_id) : null,
    comment: String(x.comment ?? ''),
    created_at: createdISO, // ← только ISO
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
  };
}

/* ======================== GET: список ======================== */
export async function GET(req: NextRequest, ctx: any) {
  try {
    // В Next 15 params может быть промисом — дожидаемся (await на plain-объекте тоже безопасен)
    const { id } = await ctx.params;
    const mangaId = toInt(id);
    if (!Number.isFinite(mangaId))
      return NextResponse.json({ ok: false, message: 'Bad id' }, { status: 400 });

    const sp = req.nextUrl.searchParams;
    const paged = Number(sp.get('paged') ?? '0') === 1;
    const limit = Math.min(Math.max(Number(sp.get('limit') ?? '15'), 1), 50);
    const cursor = sp.get('cursor') || undefined;

    if (!paged) {
      // === legacy-режим: как было раньше (всё сразу) ===
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
      const items = (r.rows || []).map(mapRow);
      return NextResponse.json({ ok: true, mode: 'legacy', items });
    }

    // === paged-режим: корневые постранично, плюс реплаи к видимым корням ===

    // 1) все закреплённые корни (обычно мало)
    const pinnedQ = await query<any>(
      `
      select
        c.*,
        p.username  as _profile_username,
        p.avatar_url as _profile_avatar
      from public.manga_comments c
      left join public.profiles p on p.id = c.user_id
      where c.manga_id = $1
        and c.parent_id is null
        and coalesce(c.is_pinned, false) = true
      order by c.created_at desc, c.id desc
      `,
      [mangaId],
    );
    const pinnedRoots = (pinnedQ.rows || []).map(mapRow);

    // 2) незакреплённые корни — порционно по keyset
    let itemsQ;
    if (!cursor) {
      itemsQ = await query<any>(
        `
        select
          c.*,
          p.username  as _profile_username,
          p.avatar_url as _profile_avatar
        from public.manga_comments c
        left join public.profiles p on p.id = c.user_id
        where c.manga_id = $1
          and c.parent_id is null
          and coalesce(c.is_pinned, false) = false
        order by c.created_at desc, c.id desc
        limit $2
        `,
        [mangaId, limit],
      );
    } else {
      const c = b64decode<{ created_at: string; id: string }>(cursor);
      itemsQ = await query<any>(
        `
        select
          c.*,
          p.username  as _profile_username,
          p.avatar_url as _profile_avatar
        from public.manga_comments c
        left join public.profiles p on p.id = c.user_id
        where c.manga_id = $1
          and c.parent_id is null
          and coalesce(c.is_pinned, false) = false
          and (c.created_at, c.id) < ($2::timestamptz, $3::uuid)
        order by c.created_at desc, c.id desc
        limit $4
        `,
        [mangaId, c.created_at, c.id, limit],
      );
    }

    const pageRoots = (itemsQ.rows || []).map(mapRow);

    // 3) Курсор считаем по последнему НЕзакреплённому корню
    // 3) Курсор считаем по последнему НЕзакреплённому корню
    const nextCursor =
    pageRoots.length === limit
      ? (() => {
          const last = pageRoots[pageRoots.length - 1];
          const lastISO = new Date(last.created_at).toISOString();
          return b64encode({ created_at: lastISO, id: last.id });
        })()
      : null;

    // 4) Подтягиваем ответы.
    //    ВАЖНО: если это первая страница (cursor отсутствует) — берём детей для pinned + pageRoots.
    //           Если это НЕ первая страница — только для pageRoots (чтобы не было дублей детей pinned).
    const isFirstPage = !cursor;
    const rootsForChildren = isFirstPage ? [...pinnedRoots, ...pageRoots] : pageRoots;

    let children: ReturnType<typeof mapRow>[] = [];
    if (rootsForChildren.length > 0) {
    const childrenQ = await query<any>(
      `
      select
        c.*,
        p.username  as _profile_username,
        p.avatar_url as _profile_avatar
      from public.manga_comments c
      left join public.profiles p on p.id = c.user_id
      where c.manga_id = $1
        and c.parent_id = any($2::uuid[])
      order by c.created_at desc, c.id desc
      `,
      [mangaId, rootsForChildren.map(r => r.id)],
    );
    children = (childrenQ.rows || []).map(mapRow);
    }

    // 5) Возвращаем items
    const items = isFirstPage
    ? [...pinnedRoots, ...pageRoots, ...children] // первая страница: показываем и pinned, и их детей
    : [...pageRoots, ...children];               // последующие: pinned не дублируем вообще

    return NextResponse.json({ ok: true, mode: 'paged', items, nextCursor });

  } catch (e: any) {
    return jserr(e);
  }
}

/* ======================== POST: создать ======================== */
export async function POST(req: NextRequest, ctx: any) {
  try {
    const me = await getAuthUser(req);
    if (!me?.id) return NextResponse.json({ ok: false, message: 'unauthorized' }, { status: 401 });

    const { id } = await ctx.params; // await params — чтобы не ловить warning
    const mangaId = toInt(id);
    if (!Number.isFinite(mangaId))
      return NextResponse.json({ ok: false, message: 'Bad id' }, { status: 400 });

    const body = await req.json().catch(() => ({} as any));
    let html = String(body?.comment ?? '').trim();
    const parent_id =
      typeof body?.parent_id === 'string' && body.parent_id.length > 0 ? body.parent_id : null;

    const as_team = Boolean(body?.as_team);
    const pin = Boolean(body?.pin);

    if (!html) return NextResponse.json({ ok: false, message: 'Empty comment' }, { status: 422 });
    // общий технический хард-лимит по размеру HTML сохраняем как было
    if (html.length > 8000)
      return NextResponse.json({ ok: false, message: 'Comment too long' }, { status: 413 });

    // ── лимиты 400/1000/∞ по «чистому» тексту ─────────────────────
    const isAdminMod = me.role === 'admin' || me.role === 'moderator';
    const leaderTeamId = await getLeaderTeamIdForTitle(me.id, mangaId);
    const max = isAdminMod ? Number.POSITIVE_INFINITY : (leaderTeamId ? 1000 : 400);
    const len = plainLen(html);

    if (len > (isFinite(max) ? (max as number) : 1e9)) {
      const shown = isFinite(max) ? max : '∞';
      return NextResponse.json({ ok: false, message: `limit_exceeded:${shown}` }, { status: 400 });
    }

    // санитайзим после проверок (логика сохранена)
    html = sanitizeHtml(html);

    // «коммент от команды» только если юзер — лидер,
    // пин на создании возможен только вместе с комментом от команды
    const isTeam = as_team && leaderTeamId != null;
    const teamId = isTeam ? Number(leaderTeamId) : null;
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

    // нормализуем created_at и в POST-ответе тоже
    const createdISO =
      row?.created_at instanceof Date
        ? row.created_at.toISOString()
        : new Date(String(row?.created_at ?? Date.now())).toISOString();

    const item = {
      id: String(row.id),
      manga_id: mangaId,
      user_id: String(me.id),
      comment: String(row.comment ?? ''),
      created_at: createdISO,
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

