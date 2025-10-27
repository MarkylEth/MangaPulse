// app/api/manga/[id]/comments/[commentId]/route.ts
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
function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}
function toInt(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
}

/* ===== PATCH: обновить флаги (тут — только is_pinned, "один закреп") ===== */
export async function PATCH(req: NextRequest, ctx: { params: { id: string; commentId: string } }) {
  try {
    const me = await getAuthUser(req);
    if (!me?.id) return json({ ok: false, message: 'unauthorized' }, 401);

    const mangaId = toInt(ctx.params.id);
    const cid = String(ctx.params.commentId || '');
    if (!Number.isFinite(mangaId) || !cid) return json({ ok: false, message: 'bad_params' }, 400);

    const body = await req.json().catch(() => ({}));
    const nextPinned: boolean | undefined =
      typeof body?.is_pinned === 'boolean' ? body.is_pinned : undefined;
    if (nextPinned === undefined) return json({ ok: false, message: 'nothing_to_update' }, 400);

    // права: админ/модер ИЛИ лидер тайтла (как было у тебя)
    const role = String(me.role ?? 'user').toLowerCase();
    const isAdminMod = role === 'admin' || role === 'moderator';
    const leaderTeamId = await getLeaderTeamIdForTitle(me.id, mangaId);
    const isLeader = !!leaderTeamId;
    if (!(isAdminMod || isLeader)) return json({ ok: false, message: 'forbidden' }, 403);

    // проверим, что комментарий существует, принадлежит тайтлу и является корневым
    const r1 = await query<{ id: string; parent_id: string | null }>(
      `select id, parent_id
         from public.manga_comments
        where id = $1 and manga_id = $2
        limit 1`,
      [cid, mangaId],
    );
    const c = r1.rows[0];
    if (!c) return json({ ok: false, message: 'not_found' }, 404);
    if (c.parent_id !== null) {
      return json({ ok: false, message: 'only_root_comments_can_be_pinned' }, 400);
    }

    // атомарно: "снять со всех + поставить на один" или "снять с выбранного"
    await query('BEGIN');
    try {
      if (nextPinned) {
        await query(
          `update public.manga_comments
              set is_pinned = false, updated_at = now()
            where manga_id = $1
              and parent_id is null
              and is_pinned is true`,
          [mangaId],
        );

        await query(
          `update public.manga_comments
              set is_pinned = true, updated_at = now()
            where id = $1 and manga_id = $2 and parent_id is null`,
          [cid, mangaId],
        );
      } else {
        await query(
          `update public.manga_comments
              set is_pinned = false, updated_at = now()
            where id = $1 and manga_id = $2`,
          [cid, mangaId],
        );
      }
      await query('COMMIT');
    } catch (e) {
      await query('ROLLBACK').catch(() => {});
      return jserr(e);
    }

    return json({ ok: true });
  } catch (e: any) {
    return jserr(e);
  }
}

/* ===== DELETE: удалить комментарий и его ответы ===== */
export async function DELETE(req: NextRequest, ctx: { params: { id: string; commentId: string } }) {
  try {
    const me = await getAuthUser(req);
    if (!me?.id) return json({ ok: false, message: 'unauthorized' }, 401);

    const mangaId = toInt(ctx.params.id);
    const cid = String(ctx.params.commentId || '');
    if (!Number.isFinite(mangaId) || !cid) return json({ ok: false, message: 'bad_params' }, 400);

    // автор комментария?
    const curr = await query<{ user_id: string | null }>(
      `select user_id::text as user_id
         from public.manga_comments
        where id = $1 and manga_id = $2
        limit 1`,
      [cid, mangaId],
    );
    const row = curr.rows?.[0];
    if (!row) return json({ ok: false, message: 'not_found' }, 404);

    const myId = String(me.id);
    const role = String(me.role ?? 'user').toLowerCase();
    const isAdminMod = role === 'admin' || role === 'moderator';
    const isAuthor = row.user_id != null && row.user_id === myId;

    if (!(isAuthor || isAdminMod)) return json({ ok: false, message: 'forbidden' }, 403);

    // удаляем сам комментарий и его ответы
    await query(
      `delete from public.manga_comments
        where manga_id = $1 and (id = $2 or parent_id = $2)`,
      [mangaId, cid],
    );

    return json({ ok: true });
  } catch (e: any) {
    return jserr(e);
  }
}

