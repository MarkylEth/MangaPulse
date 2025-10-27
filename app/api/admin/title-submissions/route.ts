//app/api/admin/title-submissions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
export const dynamic = 'force-dynamic';

/* ---------------- helpers ---------------- */

function toStrList(v: any): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(String).map(s => s.trim()).filter(Boolean);
  if (typeof v === 'string') {
    try { const j = JSON.parse(v); return toStrList(j); } catch {}
    return v.split(/[,\n;|]+/g).map(s => s.trim()).filter(Boolean);
  }
  if (typeof v === 'object') {
    const arr =
      (v as any).genres ?? (v as any).genre ?? (v as any).tags ?? (v as any).tag ??
      (v as any).values ?? (v as any).names ?? Object.values(v as any);
    return toStrList(arr);
  }
  return [String(v)].filter(Boolean);
}

function uniq<T>(xs: T[]): T[] {
  const s = new Set<T>();
  const out: T[] = [];
  for (const x of xs) { if (!s.has(x)) { s.add(x); out.push(x); } }
  return out;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeBody(raw: any) {
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
    payload: raw?.payload ?? {},
  };
}

function toNameList(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) {
    return v
      .map((x) => (x && (x.name ?? x.title ?? x.label ?? x)) as any)
      .map((s) => String(s || '').trim())
      .filter(Boolean);
  }
  if (typeof v === 'string') return [v.trim()].filter(Boolean);
  if (typeof v === 'object') return toNameList(Object.values(v));
  return [];
}

function toIdList(v: any): number[] {
  if (!v) return [];
  if (Array.isArray(v)) {
    return v
      .map(x => Number((x && (x.id ?? x)) ?? NaN))
      .filter(n => Number.isFinite(n));
  }
  return [];
}

/** Fallback-строки для автор/художник (если в payload нет чистых имён) */
function authorTextFrom(p: any): string | null {
  const names = uniq([
    ...(p?.author ? [String(p.author)] : []),
    ...(p?.author_name ? [String(p.author_name)] : []),
    ...toNameList(p?.authors),
  ].map(s => s.trim()).filter(Boolean));
  return names.length ? names.join(', ') : null;
}
function artistTextFrom(p: any): string | null {
  const names = uniq([
    ...(p?.artist ? [String(p.artist)] : []),
    ...(p?.artist_name ? [String(p.artist_name)] : []),
    ...toNameList(p?.artists),
  ].map(s => s.trim()).filter(Boolean));
  return names.length ? names.join(', ') : null;
}

/** Нормализация форматов выпуска → русские метки */
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

/* для списка в админке */
function transformRowToItem(row: any) {
  const p = row.payload || {};
  const authorStr    = authorTextFrom(p);
  const artistStr    = artistTextFrom(p);
  const publisherStr = (p.publisher ?? p.publisher_name ?? toNameList(p.publishers).join(', ')) || null;

  return {
    id: row.id,
    type: row.type as 'title_add' | 'title_edit',
    status: row.status,
    created_at: row.created_at,
    reviewed_at: row.reviewed_at,
    manga_id: row.manga_id ?? null,
    payload: p,

    title: p.title_ru || p.title || 'Без названия',
    title_romaji: p.title_romaji ?? null,
    cover_url: p.cover_url ?? null,

    author: authorStr,
    artist: artistStr,
    publisher: publisherStr,

    description: p.description ?? null,
    status_human: p.status ?? null,
    translation_status: p.translation_status ?? null,
    age_rating: p.age_rating ?? null,
    release_year: p.release_year ?? null,
    type_human: p.type ?? null,

    genres: row.genres || p.genres || null,
    tags: row.tags || p.tags || null,
    release_formats: row.release_formats || p.release_formats || null,

    author_comment: row.author_comment || null,
    author_name: row.author_name || p.author_name || null,
    sources: row.source_links || null,
  };
}

/* ---------------- служебные апдейтеры ---------------- */

async function replaceGenres(mangaId: number, list: string[]) {
  await query(`delete from manga_genres where manga_id = $1`, [mangaId]);
  if (list.length) {
    const valuesSql = list.map((_, i) => `($1, $${i + 2})`).join(',');
    await query(
      `insert into manga_genres (manga_id, genre) values ${valuesSql}`,
      [mangaId, ...list]
    );
  }
  await query(`update manga set genres = $2 where id = $1`, [mangaId, list]);
}

async function replaceTranslators(mangaId: number, teamIds: number[]) {
  await query(`delete from translator_team_manga where manga_id = $1`, [mangaId]);
  if (teamIds.length) {
    const values = teamIds.map((_, i) => `($${i + 2}, $1)`).join(',');
    await query(
      `insert into translator_team_manga (team_id, manga_id) values ${values}`,
      [mangaId, ...teamIds]
    );
  }
}

async function replaceMangaPeople(
  mangaId: number,
  authorIds: number[],
  artistIds: number[],
) {
  const total = (authorIds?.length ?? 0) + (artistIds?.length ?? 0);
  if (!total) return;

  await query(`delete from manga_people where manga_id = $1`, [mangaId]);

  type Pair = [id: number, role: 'AUTHOR' | 'ARTIST'];
  const pairs: Pair[] = [];
  for (const id of authorIds) pairs.push([id, 'AUTHOR']);
  for (const id of artistIds) pairs.push([id, 'ARTIST']);

  if (pairs.length) {
    const valuesSql = pairs.map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3}, now())`).join(',');
    const params: any[] = [mangaId];
    for (const [pid, role] of pairs) params.push(pid, role);
    await query(
      `insert into manga_people (manga_id, person_id, role, assigned_at)
       values ${valuesSql}`,
      params,
    );
  }

  const authorsRes =
    authorIds.length
      ? await query<{ name: string }>(
          `select name from people where id = any($1::bigint[]) order by name asc`,
          [authorIds],
        )
      : { rows: [] as { name: string }[] };
  const artistsRes =
    artistIds.length
      ? await query<{ name: string }>(
          `select name from people where id = any($1::bigint[]) order by name asc`,
          [artistIds],
        )
      : { rows: [] as { name: string }[] };

  const authorStr = authorsRes.rows.map((r) => r.name).join(', ') || null;
  const artistStr = artistsRes.rows.map((r) => r.name).join(', ') || null;

  await query(`update manga set author = $2, artist = $3 where id = $1`, [
    mangaId,
    authorStr,
    artistStr,
  ]);
}

async function replaceMangaPublishers(mangaId: number, publisherIds: number[]) {
  await query(`delete from manga_publishers where manga_id = $1`, [mangaId]);
  if (publisherIds.length) {
    const valuesSql = publisherIds.map((_, i) => `($1, $${i + 2}, now())`).join(',');
    await query(
      `insert into manga_publishers (manga_id, publisher_id, assigned_at)
       values ${valuesSql}`,
      [mangaId, ...publisherIds],
    );
  }
}

/* ---------------- GET ---------------- */

export async function GET() {
  try {
    // берём «автора заявки» из профиля, если в самой заявке не заполнено
    const r = await query(
      `select
         ts.id, ts.type, ts.status, ts.payload, ts.tags, ts.genres, ts.release_formats, ts.source_links,
         ts.manga_id, ts.reviewed_at, ts.review_note, ts.created_at, ts.author_comment, ts.user_id,
         coalesce(ts.author_name, p.display_name, u.username) as author_name
       from title_submissions ts
       left join users u on u.id = ts.user_id
       left join profiles p on p.user_id = ts.user_id
       order by ts.created_at desc
       limit 50`
    );

    const rows = r.rows;

    // Собираем все id команд переводчиков из payload
    const teamIdSet = new Set<number>();
    for (const row of rows) {
      const p = row.payload ?? {};
      const arr = Array.isArray(p.translators) ? p.translators : [];
      for (const x of arr) {
        const id = Number(x?.id ?? x);
        if (Number.isFinite(id)) teamIdSet.add(id);
      }
    }

    // тянем имена команд одним запросом
    let teamNameById = new Map<number, string>();
    if (teamIdSet.size) {
      const ids = Array.from(teamIdSet);
      const q = await query<{ id: number; name: string }>(
        `select id, name from translator_teams where id = any($1::bigint[])`,
        [ids]
      );
      teamNameById = new Map(q.rows.map(r => [r.id, r.name]));
    }

    // маппим строки в «обогащённые» элементы для фронта
    const items = rows.map(row => {
      const item = transformRowToItem(row) as any;
      const p = row.payload ?? {};
      const ids = (Array.isArray(p.translators) ? p.translators : [])
        .map((x: any) => Number(x?.id ?? x))
        .filter((n: number) => Number.isFinite(n));
      item.translator_names = ids.map((id: number) => teamNameById.get(id)).filter(Boolean);
      return item;
    });

    const stats = {
      total: items.length,
      pending: items.filter((i: any) => i.status === 'pending').length,
      approved: items.filter((i: any) => i.status === 'approved').length,
      rejected: items.filter((i: any) => i.status === 'rejected').length,
    };
    return NextResponse.json({ ok: true, items, stats });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Internal error' }, { status: 500 });
  }
}

/* ---------------- POST ---------------- */
export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => ({}));
    const { id, cast, action, note, tags, tagsOverride, payload } = normalizeBody(raw);
    const nowIso = new Date().toISOString();

    /* -------- reject -------- */
    if (action === 'reject') {
      if (!id) return NextResponse.json({ ok: false, error: 'id and action are required' }, { status: 400 });
      await query(
        `update title_submissions
            set status='rejected', reviewed_at=$2, review_note=$3
          where id = $1::${cast}`,
        [id, nowIso, note ?? null]
      );
      return NextResponse.json({ ok: true });
    }

    /* -------- approve -------- */
    if (action === 'approve') {
      if (!id) return NextResponse.json({ ok: false, error: 'id and action are required' }, { status: 400 });

      const sRes = await query<any>(`select * from title_submissions where id = $1::${cast}`, [id]);
      if (!sRes.rowCount) return NextResponse.json({ ok: false, error: 'Suggestion not found' }, { status: 404 });

      const row = sRes.rows[0];
      const kind: 'title_add' | 'title_edit' = row.type;
      const p = (row?.payload ?? {}) as any;

      // жанры
      const genreList = uniq(
        toStrList(row?.genres).length ? toStrList(row?.genres) :
        (toStrList(p.genre_names).length ? toStrList(p.genre_names) : toStrList(p.genres))
      );

      // форматы
      const formatList = (Array.isArray(row?.release_formats) && row.release_formats.length)
        ? uniq(row.release_formats.map(String))
        : releaseFormatLabelsFrom(p);

      // теги (без добавления форматов в теги)
      const tagsFromSug = uniq([
        ...toStrList(row?.tags),
        ...toStrList(p.tags),
        ...toStrList(p.tag_names),
        ...toStrList(p.keywords),
        ...toStrList(p.tags_csv),
      ]);
      const tagList = tagsOverride ? toStrList(tags) : uniq([...tagsFromSug, ...toStrList(tags)]);

      const translatorIds = toIdList(p.translators);
      const authorIds     = toIdList(p.author_ids ?? p.authors);
      const artistIds     = toIdList(p.artist_ids ?? p.artists);
      const publisherIds  = toIdList(p.publisher_ids ?? p.publishers);

      await query('begin');
      try {
        let mangaId: number | null = row?.manga_id ?? null;

        if (kind === 'title_add') {
          const authorText = authorTextFrom(p);
          const artistText = artistTextFrom(p);

          const ins = await query<{ id: number }>(
            `insert into manga (
               cover_url, title, title_romaji, author, artist, description,
               status, translation_status, age_rating, release_year, type,
               genres, tags, release_formats, created_at
             ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, now())
             returning id`,
            [
              p.cover_url ?? null,
              p.title_ru ?? p.title ?? null,
              p.title_romaji ?? null,
              authorText ?? null,
              artistText ?? null,
              p.description ?? null,
              p.status ?? null,
              p.translation_status ?? null,
              p.age_rating ?? null,
              p.release_year ?? null,
              p.type ?? null,
              genreList,
              tagList,
              formatList,
            ]
          );
          mangaId = ins.rows?.[0]?.id ?? null;
          if (!mangaId) throw new Error('Insert into manga failed');

          if (genreList.length) await replaceGenres(mangaId, genreList);
          if (translatorIds.length) await replaceTranslators(mangaId, translatorIds);
          if (authorIds.length || artistIds.length) await replaceMangaPeople(mangaId, authorIds, artistIds);
          await replaceMangaPublishers(mangaId, publisherIds);
        } else {
          if (mangaId == null) {
            const pid = Number(p.mangaId ?? p.manga_id ?? NaN);
            if (Number.isFinite(pid)) mangaId = pid;
          }
          if (mangaId == null) throw new Error('Для title_edit не передан manga_id');

          const fields: Record<string, any> = {};
          if ('cover_url' in p) fields.cover_url = p.cover_url ?? null;
          if ('title_ru' in p || 'title' in p) fields.title = p.title_ru ?? p.title ?? null;
          if ('title_romaji' in p) fields.title_romaji = p.title_romaji ?? null;
          if ('description' in p) fields.description = p.description ?? null;
          if ('status' in p) fields.status = p.status ?? null;
          if ('translation_status' in p) fields.translation_status = p.translation_status ?? null;
          if ('age_rating' in p) fields.age_rating = p.age_rating ?? null;
          if ('release_year' in p) fields.release_year = p.release_year ?? null;
          if ('type' in p) fields.type = p.type ?? null;

          if ('release_formats' in p || 'release_format_keys' in p || 'format' in p || 'formats' in p) {
            fields.release_formats = formatList;
          }

          if ('author' in p || 'author_name' in p || 'authors' in p) fields.author = authorTextFrom(p);
          if ('artist' in p || 'artist_name' in p || 'artists' in p) fields.artist = artistTextFrom(p);

          fields.genres = genreList;
          fields.tags = tagList;

          const keys = Object.keys(fields);
          if (keys.length) {
            const setSql = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
            await query(`update manga set ${setSql} where id = $1`, [mangaId, ...keys.map(k => fields[k])]);
          }

          await replaceGenres(mangaId, genreList);
          if (translatorIds.length) await replaceTranslators(mangaId, translatorIds);
          if (authorIds.length || artistIds.length) await replaceMangaPeople(mangaId, authorIds, artistIds);
          await replaceMangaPublishers(mangaId, publisherIds);

          if (row.manga_id == null) {
            await query(`update title_submissions set manga_id = $2 where id = $1::${cast}`, [id, mangaId]);
          }
        }

        await query(
          `update title_submissions
              set status='approved', reviewed_at=$2, review_note=$3,
                  manga_id=$4, release_formats=$5
            where id = $1::${cast}`,
          [id, nowIso, note ?? null, mangaId, formatList]
        );

        await query('commit');
        return NextResponse.json({ ok: true, manga_id: mangaId });
      } catch (e) {
        await query('rollback');
        throw e;
      }
    }

    /* -------- создание новой заявки (без approve/reject) -------- */
    const formatListForNew = releaseFormatLabelsFrom(payload);

    const insSug = await query<{ id: string }>(
      `insert into title_submissions (type, status, payload, tags, genres, release_formats, created_at)
       values ($1, 'pending', $2::jsonb, $3, $4, $5, now())
       returning id`,
      [
        payload?.type ?? 'title_add',
        payload ?? {},
        Array.isArray(payload?.tags) ? payload.tags : null,
        Array.isArray(payload?.genres) ? payload.genres : null,
        formatListForNew,
      ]
    );
    return NextResponse.json({ ok: true, id: insSug.rows?.[0]?.id ?? null });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Internal error' }, { status: 500 });
  }
}

/* ---------------- DELETE (cleanup) ---------------- */
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const cleanup = url.searchParams.get('cleanup');

    if (cleanup === 'done') {
      const r = await query(`delete from title_submissions where status in ('approved','rejected')`);
      return NextResponse.json({ ok: true, deleted: r.rowCount ?? 0 });
    }

    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Internal error' }, { status: 500 });
  }
}

