// app/api/admin/manga-moderation/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireModeratorAPI } from '@/lib/admin/api-guard';
import { logAdminAction } from '@/lib/admin/audit-log';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/* ----------------------- helpers ----------------------- */

function toStrList(v: any): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(String).map(s => s.trim()).filter(Boolean);
  if (typeof v === 'string') {
    return v.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
  }
  if (typeof v === 'object') {
    const acc = Array.isArray((v as any).names) ? (v as any).names : Object.values(v || {});
    return Array.isArray(acc) ? acc.map(String).map(s => s.trim()).filter(Boolean) : [];
  }
  return [];
}

function uniq<T>(arr: T[]): T[] {
  const s = new Set<T>();
  const out: T[] = [];
  for (const x of arr) if (!s.has(x)) { s.add(x); out.push(x); }
  return out;
}

function toNameList(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) {
    return v
      .map(it => {
        if (it == null) return '';
        if (typeof it === 'string') return it;
        if (typeof it === 'number') return String(it);
        if (typeof it === 'object') return String((it as any).name ?? (it as any).title ?? (it as any).label ?? '');
        return '';
      })
      .map(s => s.trim())
      .filter(Boolean);
  }
  if (typeof v === 'object') return toNameList(Object.values(v));
  if (typeof v === 'string') return [v.trim()].filter(Boolean);
  return [];
}

function toIdList(v: any): number[] {
  if (!v) return [];
  const raw = Array.isArray(v) ? v : [v];
  const ids = raw
    .map((x) => {
      if (x == null) return null;
      if (typeof x === 'number') return x;
      if (typeof x === 'string') {
        const n = Number(x);
        return Number.isFinite(n) ? n : null;
      }
      if (typeof x === 'object') {
        const id = (x as any).id;
        const n = Number(id);
        return Number.isFinite(n) ? n : null;
      }
      return null;
    })
    .filter((n): n is number => n != null);
  return Array.from(new Set(ids));
}

/* ----------------------------- GET ----------------------------- */

export async function GET(req: NextRequest) {
  try {
    await requireModeratorAPI(req);

    const sRes = await query<any>(
      `SELECT id, status, payload, created_at, tags, genres, 
              title_romaji, author_comment, author_name, user_id
       FROM title_submissions
       ORDER BY created_at DESC
       LIMIT 200`
    );

    const suggestions = (sRes.rows ?? []).map(r => {
      const p = r?.payload ?? {};
      const authorStr = (p.author ?? toNameList(p.authors).join(', ')) || null;
      const artistStr = (p.artist ?? toNameList(p.artists).join(', ')) || null;
      const publisherStr = (p.publisher ?? toNameList(p.publishers).join(', ')) || null;

      return {
        sid: r.id,
        uid: r.id,
        kind: 'suggestion' as const,
        title: p.title_ru ?? p.title ?? 'Без названия',
        cover_url: p.cover_url ?? null,
        author: authorStr,
        artist: artistStr,
        publisher: publisherStr,
        description: p.description ?? null,
        status: p.status ?? null,
        original_title: p.original_title ?? null,
        type: p.type ?? null,
        translation_status: p.translation_status ?? null,
        age_rating: p.age_rating ?? null,
        release_year: p.release_year ?? null,
        title_romaji: r.title_romaji ?? p.title_romaji ?? null,
        submission_status: r.status ?? 'pending',
        created_at: r.created_at,
        updated_at: null,
        genres: r.genres ?? p.genres ?? null,
        tags: r.tags ?? p.tags ?? null,
        manga_genres: null,
        tag_list: null,
        payload: p,
        translator_team_id: p.translator_team_id ?? null,
        author_comment: r.author_comment ?? null,
        sources: null,
        author_name: r.author_name ?? p.author_name ?? null,
        slug: null,
      };
    });

    const mRes = await query<any>(
      `SELECT
         m.id, m.title, m.cover_url, m.author, m.artist, m.description, m.status,
         m.created_at, m.title_romaji, m.slug, m.genres, m.tags,
         m.translation_status, m.age_rating, m.release_year, m.type,
         COALESCE((
           SELECT string_agg(pu.name, ', ' ORDER BY pu.name)
           FROM manga_publishers mp
           JOIN publishers pu ON pu.id = mp.publisher_id
           WHERE mp.manga_id = m.id
         ), NULL) as publisher
       FROM manga m
       ORDER BY m.id DESC
       LIMIT 200`
    );

    const manga = (mRes.rows ?? []).map(r => ({
      id: r.id,
      sid: null,
      uid: null,
      kind: 'manga' as const,
      title: r.title ?? 'Без названия',
      cover_url: r.cover_url ?? null,
      author: r.author ?? null,
      artist: r.artist ?? null,
      publisher: r.publisher ?? null,
      description: r.description ?? null,
      status: r.status ?? null,
      original_title: null,
      type: r.type ?? null,
      translation_status: r.translation_status ?? null,
      age_rating: r.age_rating ?? null,
      release_year: r.release_year ?? null,
      title_romaji: r.title_romaji ?? null,
      submission_status: 'approved' as const,
      created_at: r.created_at,
      updated_at: null,
      genres: r.genres ?? null,
      tags: r.tags ?? null,
      manga_genres: null,
      tag_list: null,
      payload: null,
      translator_team_id: null,
      author_comment: null,
      sources: null,
      author_name: null,
      slug: r.slug ?? null,
    }));

    const items = [...suggestions, ...manga];
    const stats = {
      total: items.length,
      manga: manga.length,
      suggestions: suggestions.length,
      pending: suggestions.filter(s => s.submission_status === 'pending').length,
      approved:
        suggestions.filter(s => s.submission_status === 'approved').length + manga.length,
      rejected: suggestions.filter(s => s.submission_status === 'rejected').length,
    };

    return NextResponse.json({ ok: true, items, stats });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('[GET /api/admin/manga-moderation]:', err);
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}

/* ----------------------------- POST ----------------------------- */

function normalize(raw: any) {
  const anyId = raw?.id ?? raw?.sid ?? raw?.uid ?? raw?.submission_id ?? raw?.manga_id;
  let action: string = (raw?.action ?? '').toString().toLowerCase().trim();
  if (action === 'approved') action = 'approve';
  if (action === 'rejected') action = 'reject';
  const idStr = anyId == null ? null : String(anyId).trim();
  const cast = idStr && UUID_RE.test(idStr) ? 'uuid' : 'bigint';
  return {
    id: idStr as string | null,
    cast,
    action,
    note: raw?.note ?? null,
    tags: raw?.tags ?? null,
    tagsOverride: !!raw?.tagsOverride,
    kind: raw?.kind ?? null,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { userId: modId } = await requireModeratorAPI(req);

    const raw = await req.json().catch(() => ({}));
    const { id, cast, action, note, tags, tagsOverride, kind } = normalize(raw);

    if (!action) {
      return NextResponse.json({ ok: false, error: 'action is required' }, { status: 400 });
    }
    if (!id) {
      return NextResponse.json({ ok: false, error: 'id is required' }, { status: 400 });
    }

    const treatAsSuggestion = kind === 'suggestion' || cast === 'uuid' || raw?.sid || raw?.uid;

    if (!treatAsSuggestion) {
      return NextResponse.json({ ok: false, error: 'unsupported kind' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();

    // reject
    if (action === 'reject') {
      await query(
        `UPDATE title_submissions
         SET status='rejected', reviewed_at=$2, review_note=$3
         WHERE id=$1::${cast}`,
        [id, nowIso, note ?? null]
      );

      // ✅ Аудит
      await logAdminAction(modId, 'manga_reject', id, {
        ip: req.headers.get('x-forwarded-for')?.split(',')[0],
        note,
      });

      return NextResponse.json({ ok: true });
    }

    // approve
    if (action !== 'approve') {
      return NextResponse.json({ ok: false, error: 'unknown action' }, { status: 400 });
    }

    const sRes = await query<any>(`SELECT * FROM title_submissions WHERE id=$1::${cast}`, [id]);
    if (!sRes.rowCount) {
      return NextResponse.json({ ok: false, error: 'Suggestion not found' }, { status: 404 });
    }

    const row = sRes.rows[0];
    const p = (row?.payload ?? {}) as any;

    const genreList = uniq(
      toStrList(p.genre_names).length ? toStrList(p.genre_names) : toStrList(p.genres)
    );
    const tagsFromSug = uniq([
      ...toStrList(row?.tags),
      ...toStrList(p.tags),
      ...toStrList(p.tag_names),
      ...toStrList(p.keywords),
      ...toStrList(p.tags_csv),
    ]);
    const tagList = tagsOverride ? toStrList(tags) : uniq([...tagsFromSug, ...toStrList(tags)]);

    const authorIds = toIdList(p.author_ids ?? p.authors);
    const artistIds = toIdList(p.artist_ids ?? p.artists);
    const publisherIds = toIdList(p.publisher_ids ?? p.publishers);

    let mangaId: number | null = row?.manga_id ?? null;

    await query('BEGIN');

    try {
      if (mangaId == null) {
        const ins = await query<{ id: number }>(
          `INSERT INTO manga (
             cover_url, title, title_romaji, author, artist, description,
             status, translation_status, age_rating, release_year, type, created_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, NOW())
           RETURNING id`,
          [
            p.cover_url ?? null,
            p.title_ru ?? p.title ?? null,
            p.title_romaji ?? null,
            null,
            null,
            p.description ?? null,
            p.status ?? null,
            p.translation_status ?? null,
            p.age_rating ?? null,
            p.release_year ?? null,
            p.type ?? null,
          ]
        );
        mangaId = ins.rows?.[0]?.id ?? null;
        if (!mangaId) throw new Error('Insert into manga failed');
      }

      await query(`UPDATE manga SET genres=$2, tags=$3 WHERE id=$1`, [mangaId, genreList, tagList]);

      if (authorIds.length) {
        const values = authorIds.map((pid, i) => `($1, $${i + 2}, 'AUTHOR')`).join(', ');
        await query(
          `INSERT INTO manga_people (manga_id, person_id, role)
           VALUES ${values}
           ON CONFLICT (manga_id, person_id, role) DO NOTHING`,
          [mangaId, ...authorIds]
        );
      }
      if (artistIds.length) {
        const values = artistIds.map((pid, i) => `($1, $${i + 2}, 'ARTIST')`).join(', ');
        await query(
          `INSERT INTO manga_people (manga_id, person_id, role)
           VALUES ${values}
           ON CONFLICT (manga_id, person_id, role) DO NOTHING`,
          [mangaId, ...artistIds]
        );
      }
      if (publisherIds.length) {
        const values = publisherIds.map((pubId, i) => `($1, $${i + 2})`).join(', ');
        await query(
          `INSERT INTO manga_publishers (manga_id, publisher_id)
           VALUES ${values}
           ON CONFLICT (manga_id, publisher_id) DO NOTHING`,
          [mangaId, ...publisherIds]
        );
      }

      await query(
        `UPDATE title_submissions
         SET status='approved', reviewed_at=$2, review_note=$3, manga_id=$4
         WHERE id=$1::${cast}`,
        [id, nowIso, note ?? null, mangaId]
      );

      await query('COMMIT');

      // ✅ Аудит
      await logAdminAction(modId, 'manga_approve', id, {
        ip: req.headers.get('x-forwarded-for')?.split(',')[0],
        manga_id: mangaId,
        note,
      });

      return NextResponse.json({ ok: true, manga_id: mangaId });
    } catch (e) {
      await query('ROLLBACK');
      throw e;
    }
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('[POST /api/admin/manga-moderation]:', err);
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}
