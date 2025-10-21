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
    const maybe = (v as any).names ?? (v as any).values ?? Object.values(v as any);
    return toStrList(maybe);
  }
  return [];
};

// те же ярлыки, что и в админ-ручке
function releaseFormatLabelsFrom(p: any): string[] {
  const raw = toStrList(
    p?.release_formats ?? p?.formats ?? p?.format ?? p?.release_format ?? p?.release_format_keys
  );
  const hasWord = (s: string, w: string) =>
    new RegExp(`(?:^|[^\\p{L}\\p{N}])${w}(?:$|[^\\p{L}\\p{N}])`, 'iu').test(s);
  const out = new Set<string>();
  for (const s0 of raw) {
    const s = String(s0).normalize('NFKC').toLowerCase().replace(/ё/g, 'е').trim();
    if ((/\b4/.test(s) && s.includes('ком')) || s.includes('yonkoma')) { out.add('4-кома (Ёнкома)'); continue; }
    if (s.includes('додз') || s.includes('doujin')) { out.add('Додзинси'); continue; }
    if (s.includes('вебтун') || s.includes('webtoon')) { out.add('Вебтун'); continue; }
    if (s.includes('сингл') || s.includes('one-shot') || s.includes('oneshot') || s.includes('ваншот')) { out.add('Сингл'); continue; }
    if (s.includes('цвет') || s.includes('color') || s.includes('full color')) { out.add('В цвете'); continue; }
    if (s.includes('сборн') || s.includes('omnibus') || s.includes('antholog')) { out.add('Сборник'); continue; }
    if ((hasWord(s, 'веб') || hasWord(s, 'web')) && !s.includes('webtoon')) { out.add('Веб'); continue; }
  }
  return Array.from(out);
}

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

    // нормализуем форматы выпуска сразу при создании заявки
    const release_formats = releaseFormatLabelsFrom(p);

    // ——— INSERT ———
    const sql = `
      INSERT INTO title_submissions (
        user_id, author_name, manga_id, type, status,
        payload, source_links, genres, tags, release_formats,
        title_romaji, author_comment, created_at
      ) VALUES (
        $1, $2, $3, $4, 'pending',
        $5::jsonb, $6::text[], $7::text[], $8::text[], $9::text[],
        $10, $11, NOW()
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
      release_formats,
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
