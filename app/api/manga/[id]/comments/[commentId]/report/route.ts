// app/api/.../route.ts  (report comment)
import { NextResponse } from 'next/server';
import { getSessionToken, verifySession } from '@/lib/auth/session';
import { SESSION_COOKIE } from '@/lib/auth/config';
import { queryAsUser, withTransactionAsUser, oneAsUser, manyAsUser } from '@/lib/db';
export const dynamic = 'force-dynamic';

/* =============== helpers & types =============== */
const AUTOHIDE = 5; // скрыть при >= 5 жалоб
const ALLOWED: Record<string, true> = {
  abuse: true, harassment: true, spam: true, hate: true, porn: true,
  illegal_trade: true, spoiler: true, offtopic: true, other: true,
  insult: true, nsfw: true, illegal: true,
};

const isUUID = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

function parseCookies(header: string | null) {
  const out: Record<string, string> = {};
  (header || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

/** Принимает "62" ИЛИ "62-one-piece" и возвращает 62; иначе null */
function parseMangaParam(s?: string | null): number | null {
  if (!s) return null;
  const m = /^(\d+)/.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function getUserId(req: Request): Promise<string | null> {
  const hdrToken = parseCookies(req.headers.get('cookie'))[SESSION_COOKIE];
  const token = hdrToken ?? (await getSessionToken());
  const sess = await verifySession(token);
  return sess?.sub ?? null;
}

async function hasColumn(table: string, column: string): Promise<boolean> {
  const rows = await manyAsUser<{ x: number }>(
    `
    SELECT 1 AS x
      FROM information_schema.columns
     WHERE table_schema='public'
       AND table_name = $1
       AND column_name = $2
     LIMIT 1
    `,
    [table, column],
    // безопасно: для information_schema контекст не важен, но передадим любой
    '00000000-0000-0000-0000-000000000000'
  );
  return rows.length > 0;
}

/* =============== route =============== */
export async function POST(
  req: Request,
  ctx: { params: { mangaId?: string; commentId?: string } }
) {
  try {
    // auth
    const me = await getUserId(req);
    if (!me) {
      return NextResponse.json({ ok: false, message: 'auth required' }, { status: 401 });
    }

    // params
    const midFromUrl = parseMangaParam(ctx.params?.mangaId ?? null);
    const commentId = String(ctx.params?.commentId || '').trim();
    if (!isUUID(commentId)) {
      return NextResponse.json({ ok: false, message: 'bad commentId' }, { status: 400 });
    }

    // body
    const body = await req.json().catch(() => ({}));
    const reason = String(body?.reason || '').toLowerCase();
    let note = String(body?.note || body?.details || '').trim();
    if (!ALLOWED[reason]) return NextResponse.json({ ok: false, message: 'bad reason' }, { status: 400 });
    if (note.length > 1000) note = note.slice(0, 1000);

    // найдём комментарий и его manga_id
    const comment = await oneAsUser<{
      id: string;
      manga_id: number;
      reports_count: number | null;
      is_hidden: boolean | null;
    }>(
      `
      SELECT id,
             manga_id,
             COALESCE(reports_count,0)::int AS reports_count,
             COALESCE(is_hidden,false)      AS is_hidden
        FROM public.manga_comments
       WHERE id = $1::uuid
       LIMIT 1
      `,
      [commentId],
      me // читаем под RLS-контекстом пользователя
    );
    if (!comment) return NextResponse.json({ ok: false, message: 'comment not found' }, { status: 404 });

    if (midFromUrl !== null && Number(comment.manga_id) !== midFromUrl) {
      return NextResponse.json({ ok: false, message: 'comment not for this manga' }, { status: 404 });
    }

    // запрет повторной жалобы
    const dup = await manyAsUser(
      `
      SELECT 1
        FROM public.comment_reports
       WHERE source='manga'
         AND comment_id=$1::uuid
         AND user_id=$2::uuid
       LIMIT 1
      `,
      [commentId, me],
      me
    );
    if (dup.length) {
      return NextResponse.json({
        ok: true,
        message: 'already reported',
        is_hidden: Boolean(comment.is_hidden),
        reports_count: Number(comment.reports_count ?? 0),
      });
    }

    // rate limit: ≤ 5 жалоб за 5 минут
    const rate = await oneAsUser<{ cnt: number }>(
      `
      SELECT COUNT(*)::int AS cnt
        FROM public.comment_reports
       WHERE user_id = $1::uuid
         AND created_at > now() - interval '5 minutes'
      `,
      [me],
      me
    );
    if ((rate?.cnt ?? 0) >= 5) {
      return NextResponse.json({ ok: false, message: 'too many reports, try later' }, { status: 429 });
    }

    // транзакция: вставка жалобы + обновление счётчиков
    await withTransactionAsUser(me, async (client) => {
      await client.query(
        `
        INSERT INTO public.comment_reports (source, comment_id, user_id, reason, details, status, created_at)
        VALUES ('manga', $1::uuid, $2::uuid, $3, NULLIF($4, ''), 'open', now())
        ON CONFLICT DO NOTHING
        `,
        [commentId, me, reason, note]
      );

      const [hasRep, hasHidden] = await Promise.all([
        hasColumn('manga_comments', 'reports_count'),
        hasColumn('manga_comments', 'is_hidden'),
      ]);

      if (hasRep && hasHidden) {
        await client.query(
          `
          UPDATE public.manga_comments
             SET reports_count = COALESCE(reports_count,0) + 1,
                 is_hidden     = CASE WHEN COALESCE(reports_count,0) + 1 >= $2
                                      THEN true ELSE is_hidden END
           WHERE id = $1::uuid
          `,
          [commentId, AUTOHIDE]
        );
      } else if (hasRep) {
        await client.query(
          `
          UPDATE public.manga_comments
             SET reports_count = COALESCE(reports_count,0) + 1
           WHERE id = $1::uuid
          `,
          [commentId]
        );
      }
    });

    // актуальное состояние
    const cur = await oneAsUser<{ reports_count: number; is_hidden: boolean }>(
      `
      SELECT COALESCE(reports_count,0)::int AS reports_count,
             COALESCE(is_hidden,false)      AS is_hidden
        FROM public.manga_comments
       WHERE id = $1::uuid
       LIMIT 1
      `,
      [commentId],
      me
    );

    return NextResponse.json(
      {
        ok: true,
        reports_count: Number(cur?.reports_count ?? 0),
        is_hidden: Boolean(cur?.is_hidden),
      },
      { headers: { 'Cache-Control': 'no-store', Vary: 'Cookie' } }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || 'server error' }, { status: 500 });
  }
}

