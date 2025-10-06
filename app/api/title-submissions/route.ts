import { NextRequest } from 'next/server';
import { query } from '@/lib/db';

/* ------------- helpers ------------- */
const toStr = (v: any) => (v == null ? null : String(v));
const toStrList = (v: any): string[] => {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
  if (typeof v === 'string') {
    const lines = v.split(/\r?\n/).flatMap((s) => s.split(/[,\t;|]/));
    return lines.map((s) => s.trim()).filter(Boolean);
  }
  if (v && typeof v === 'object') {
    // поддержка payload.tags = {names:[...]} и т.п.
    const maybe = (v as any).names ?? (v as any).values ?? Object.values(v as any);
    return toStrList(maybe);
  }
  return [];
};

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const ct = req.headers.get('content-type') || '';
    let body: any = {};
    if (ct.includes('application/json')) {
      body = await req.json();
    } else if (ct.includes('form-data')) {
      const fd = await req.formData();
      body = Object.fromEntries(fd.entries());
    } else {
      try { body = JSON.parse(await req.text()); }
      catch { return Response.json({ ok: false, error: 'Body must be JSON' }, { status: 400 }); }
    }

    // ——— алиасы/нормализация ———
    const user_id: string | null = body.user_id ?? null;
    const author_name: string | null = body.author_name ?? null;

    const author_comment: string | null =
      body.author_comment ?? body.author_comm ?? body.comment ?? null;

    const p: Record<string, any> = body.payload ?? body ?? {};

    const rawMid =
      body.manga_id ?? body.mangaId ?? p.manga_id ?? p.mangaId ?? null;
    const manga_id =
      rawMid == null ? null : (Number.isFinite(Number(rawMid)) ? Number(rawMid) : null);

    const submission_type: 'title_add' | 'title_edit' =
      body.type === 'title_edit' ? 'title_edit' : (manga_id ? 'title_edit' : 'title_add');

    const source_links = toStrList(
      body.source_links ?? body.sources ?? p.source_links ?? p.sources ?? []
    );
    const genres = toStrList(body.genres ?? p.genres ?? []);
    const tags   = toStrList(body.tags   ?? p.tags   ?? p.tag_names ?? p.keywords ?? []);

    const title_romaji = toStr(p.title_romaji);

    // ——— INSERT ———
    const sql = `
      INSERT INTO title_submissions (
        user_id, author_name, manga_id, type, status,
        payload, source_links, genres, tags,
        title_romaji, author_comment, created_at
      ) VALUES (
        $1, $2, $3, $4, 'pending',
        $5::jsonb, $6::text[], $7::text[], $8::text[],
        $9, $10, NOW()
      )
      RETURNING id
    `;
    const params = [
      user_id,
      author_name,
      manga_id,
      submission_type,
      JSON.stringify(p),
      source_links,
      genres,
      tags,
      title_romaji,
      author_comment,
    ];
    const { rows } = await query<{ id: number }>(sql, params);
    return Response.json({ ok: true, id: rows[0].id });
  } catch (e: any) {
    console.error(e);
    return Response.json({ ok: false, error: e?.message || 'submit_failed' }, { status: 500 });
  }
}
