// app/api/admin/mod/comments/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { requireModeratorAPI } from '@/lib/admin/api-guard';
import { logAdminAction } from '@/lib/admin/audit-log';
export const dynamic = 'force-dynamic';

type Row = Record<string, any>;

type Sql = {
  (q: TemplateStringsArray, ...vals: any[]): Promise<Row[]>;
  query: (text: string, params?: any[]) => Promise<Row[]>;
};

function isUUID(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

async function getSql(): Promise<Sql | null> {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const mod: any = await import('@neondatabase/serverless');
  const neon = mod?.neon || mod?.default?.neon;
  const raw = neon(url);

  const wrap = (async (q: TemplateStringsArray, ...vals: any[]) => {
    const res: any = await (raw as any)(q, ...vals);
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.rows)) return res.rows;
    const maybe = res?.results?.[0]?.rows;
    return Array.isArray(maybe) ? maybe : [];
  }) as Sql;

  wrap.query = async (text: string, params: any[] = []) => {
    const res: any = await (raw as any).query(text, params);
    if (Array.isArray(res?.rows)) return res.rows;
    return Array.isArray(res) ? res : [];
  };

  return wrap;
}

type Source = 'manga' | 'page' | 'post';

function buildWhere({ q, textCol }: { q: string; textCol: string }) {
  const where: string[] = ['TRUE'];
  const params: any[] = [];
  if (q) {
    params.push(`%${q}%`);
    where.push(`${textCol} ILIKE $${params.length}`);
  }
  return { where: where.join(' AND '), params };
}

async function listOne(
  sql: Sql,
  src: Source,
  { q, onlyProblem, limit, offset }: { q: string; onlyProblem: boolean; limit: number; offset: number }
) {
  const cfg =
    src === 'manga'
      ? { table: 'public.manga_comments', refCol: 'c.manga_id', textCol: 'c.comment' }
      : src === 'page'
      ? { table: 'public.page_comments', refCol: 'c.page_id', textCol: 'c.content' }
      : { table: 'public.team_post_comments', refCol: 'c.post_id', textCol: 'c.content' };

  const { where, params } = buildWhere({ q, textCol: cfg.textCol });
  const having = onlyProblem ? 'HAVING COUNT(r.*) > 0' : '';

  const listSql = `
    SELECT
      c.id::text AS id,
      $${params.length + 1}::text AS source,
      ${cfg.refCol} AS ref_id,
      ${cfg.textCol}::text AS text,
      c.created_at,
      COALESCE(COUNT(r.*), 0)::int AS reports_count,
      (COALESCE(COUNT(r.*), 0) >= 5) AS is_hidden
    FROM ${cfg.table} c
    LEFT JOIN public.comment_reports r
      ON r.comment_id = c.id
     AND r.source = $${params.length + 1}
     AND COALESCE(r.status, 'open') = 'open'
    WHERE ${where}
    GROUP BY c.id
    ${having}
    ORDER BY c.created_at DESC
    LIMIT $${params.length + 2} OFFSET $${params.length + 3}
  `;

  const listParams = [...params, src, limit, offset];
  const items = await sql.query(listSql, listParams);

  const countSql = `
    SELECT COUNT(*)::int AS cnt
    FROM (
      SELECT c.id
      FROM ${cfg.table} c
      LEFT JOIN public.comment_reports r
        ON r.comment_id = c.id
       AND r.source = $${params.length + 1}
       AND COALESCE(r.status, 'open') = 'open'
      WHERE ${where}
      GROUP BY c.id
      ${having}
    ) t
  `;
  const countParams = [...params, src];
  const cnt = await sql.query(countSql, countParams);
  const total = Number(cnt?.[0]?.cnt || 0);

  const norm = items
    .map(r => [
      {
        id: r.id,
        source: src,
        target_id: r.ref_id,
        content: r.text,
        created_at: r.created_at,
        reports_count: Number(r.reports_count || 0),
        is_hidden: !!r.is_hidden,
      },
    ])
    .flat();

  return { items: norm, total };
}

export async function GET(req: NextRequest) {
  try {
    await requireModeratorAPI(req);

    const sql = await getSql();
    if (!sql) {
      return NextResponse.json({ ok: false, message: 'DB not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 50)));
    const offset = Math.max(0, Number(searchParams.get('offset') || 0));
    const q = (searchParams.get('q') || '').trim();
    const source = (searchParams.get('source') || 'all').toLowerCase();
    const onlyProblem = (searchParams.get('onlyProblem') || '').toLowerCase() === 'true';

    if (source === 'manga' || source === 'page' || source === 'post') {
      const { items, total } = await listOne(sql, source as Source, { q, onlyProblem, limit, offset });
      return NextResponse.json({ ok: true, items, total });
    }

    const fatLimit = limit + offset;
    const [a, b, c] = await Promise.all([
      listOne(sql, 'manga', { q, onlyProblem, limit: fatLimit, offset: 0 }),
      listOne(sql, 'page', { q, onlyProblem, limit: fatLimit, offset: 0 }),
      listOne(sql, 'post', { q, onlyProblem, limit: fatLimit, offset: 0 }),
    ]);

    const merged = [...a.items, ...b.items, ...c.items].sort(
      (x, y) => +new Date(y.created_at) - +new Date(x.created_at)
    );

    const total = a.total + b.total + c.total;
    const paged = merged.slice(offset, offset + limit);

    return NextResponse.json({ ok: true, items: paged, total });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('[GET /api/admin/mod/comments]:', err);
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId: modId } = await requireModeratorAPI(req);

    const sql = await getSql();
    if (!sql) {
      return NextResponse.json({ ok: false, message: 'DB not configured' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '');
    const src = String(body?.source || '');
    const id = String(body?.id || '');

    if (!['approve', 'delete'].includes(action)) {
      return NextResponse.json({ ok: false, message: 'Bad action' }, { status: 400 });
    }

    if (!['manga', 'page', 'post'].includes(src)) {
      return NextResponse.json({ ok: false, message: 'Bad source' }, { status: 400 });
    }

    if (!isUUID(id)) {
      return NextResponse.json({ ok: false, message: 'Bad id (uuid expected)' }, { status: 400 });
    }

    if (action === 'approve') {
      await sql.query(
        `UPDATE public.comment_reports
         SET status = 'closed'
         WHERE source = $1
           AND comment_id = $2::uuid
           AND COALESCE(status, 'open') = 'open'`,
        [src, id]
      );

      // ✅ Аудит
      await logAdminAction(modId, 'comment_approve', id, {
        ip: req.headers.get('x-forwarded-for')?.split(',')[0],
        source: src,
      });

      return NextResponse.json({ ok: true });
    }

    // delete
    const table =
      src === 'manga'
        ? 'public.manga_comments'
        : src === 'page'
        ? 'public.page_comments'
        : 'public.team_post_comments';

    await sql.query(`DELETE FROM ${table} WHERE id = $1::uuid`, [id]);

    await sql.query(
      `UPDATE public.comment_reports
       SET status = 'closed'
       WHERE source = $1
         AND comment_id = $2::uuid
         AND COALESCE(status, 'open') = 'open'`,
      [src, id]
    );

    // ✅ Аудит
    await logAdminAction(modId, 'comment_delete', id, {
      ip: req.headers.get('x-forwarded-for')?.split(',')[0],
      source: src,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('[POST /api/admin/mod/comments]:', err);
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}
