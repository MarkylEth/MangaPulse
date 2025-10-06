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

/* ===== PATCH: обновить флаги (сейчас — только is_pinned) ===== */
export async function PATCH(req: NextRequest, ctx: { params: { id: string; commentId: string } }) {
  try {
    const me = await getAuthUser(req);
    if (!me?.id) return NextResponse.json({ ok: false, message: 'unauthorized' }, { status: 401 });

    const mangaId = toInt(ctx.params.id);
    const cid = String(ctx.params.commentId || '');
    if (!Number.isFinite(mangaId) || !cid)
      return NextResponse.json({ ok: false, message: 'Bad params' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const hasPin = typeof body?.is_pinned === 'boolean';
    if (!hasPin) return NextResponse.json({ ok: false, message: 'Nothing to update' }, { status: 400 });

    // права: автор, админ/модератор или лидер своей команды-коммента
    const curr = await query<any>(
      `select user_id::text as user_id, is_team_comment, team_id from public.manga_comments where id = $1 and manga_id = $2 limit 1`,
      [cid, mangaId],
    );
    const row = curr.rows?.[0];
    if (!row) return NextResponse.json({ ok: false, message: 'Not found' }, { status: 404 });

    const myId = String(me.id);
    const myRole = String(me.role ?? 'user').toLowerCase();
    const can =
      row.user_id === myId ||
      myRole === 'admin' ||
      myRole === 'moderator' ||
      (row.is_team_comment && me.leaderTeamId != null && Number(row.team_id) === Number(me.leaderTeamId));

    if (!can) return NextResponse.json({ ok: false, message: 'forbidden' }, { status: 403 });

    const upd = await query<any>(
      `update public.manga_comments set is_pinned = $3, updated_at = now() where id = $1 and manga_id = $2`,
      [cid, mangaId, !!body.is_pinned],
    );

    return NextResponse.json({ ok: true, updated: upd.rowCount ?? 0 });
  } catch (e: any) {
    return jserr(e);
  }
}

/* ===== DELETE: удалить комментарий и его ответы ===== */
export async function DELETE(req: NextRequest, ctx: { params: { id: string; commentId: string } }) {
  try {
    const me = await getAuthUser(req);
    if (!me?.id) return NextResponse.json({ ok: false, message: 'unauthorized' }, { status: 401 });

    const mangaId = toInt(ctx.params.id);
    const cid = String(ctx.params.commentId || '');
    if (!Number.isFinite(mangaId) || !cid)
      return NextResponse.json({ ok: false, message: 'Bad params' }, { status: 400 });

    const curr = await query<any>(
      `select user_id::text as user_id, is_team_comment, team_id from public.manga_comments where id = $1 and manga_id = $2 limit 1`,
      [cid, mangaId],
    );
    const row = curr.rows?.[0];
    if (!row) return NextResponse.json({ ok: false, message: 'Not found' }, { status: 404 });

    const myId = String(me.id);
    const myRole = String(me.role ?? 'user').toLowerCase();
    const can =
      row.user_id === myId ||
      myRole === 'admin' ||
      myRole === 'moderator' ||
      (row.is_team_comment && me.leaderTeamId != null && Number(row.team_id) === Number(me.leaderTeamId));

    if (!can) return NextResponse.json({ ok: false, message: 'forbidden' }, { status: 403 });

    await query(
      `delete from public.manga_comments where manga_id = $1 and (id = $2 or parent_id = $2)`,
      [mangaId, cid],
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return jserr(e);
  }
}
