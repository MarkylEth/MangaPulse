// app/api/manga/[id]/similar/route.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getViewerId } from '@/lib/auth/route-guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REMOVE_THRESHOLD = -300;
function toId(v: unknown): number | null { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; }

async function getMangaCols() {
  const { rows } = await query(`
    select column_name
    from information_schema.columns
    where table_name = 'manga' and table_schema = any(current_schemas(false))
  `);
  const cols = new Set<string>((rows || []).map((r: any) => String(r.column_name)));
  const titleCandidates = ['title','title_ru','en_title','name','ru_name','en_name','other_titles'].filter(c => cols.has(c));
  const posterCandidates = ['cover_url','poster_url','image_url','poster','cover'].filter(c => cols.has(c));
  const titleExpr = titleCandidates.length ? `coalesce(${titleCandidates.map(c => `nullif(m.${c}, '')`).join(',')})` : `m.title`;
  const posterExpr = posterCandidates.length ? `coalesce(${posterCandidates.map(c => `m.${c}`).join(',')})` : `null`;
  const hasSlug = cols.has('slug');
  return { titleExpr, posterExpr, hasSlug };
}

/* GET */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const mangaId = toId(params.id);
  if (!mangaId) return NextResponse.json({ ok: false, message: 'Bad id' }, { status: 400 });

  const viewerRaw = await getViewerId(req).catch(() => null);
  const viewer = viewerRaw == null ? null : String(viewerRaw);

  try {
    const { titleExpr, posterExpr, hasSlug } = await getMangaCols();
    const { rows } = await query<any>(`
      with pairs_all as (
        select st.id as pair_id, st.created_at, st.likes, st.dislikes, st.other_id as other_id
          from similar_titles st where st.manga_id = $1
        union all
        select st.id as pair_id, st.created_at, st.likes, st.dislikes, st.manga_id as other_id
          from similar_titles st where st.other_id = $1
      ),
      canon as (
        select distinct on (p.other_id) p.other_id, p.pair_id, p.created_at, p.likes, p.dislikes
          from pairs_all p order by p.other_id, p.created_at asc, p.pair_id asc
      )
      select c.pair_id, c.other_id, ${titleExpr} as title,
             ${hasSlug ? 'm.slug' : 'null'} as slug,
             ${posterExpr} as poster_url,
             c.likes, c.dislikes, c.created_at,
             me.value as my_value
        from canon c
        join manga m on m.id = c.other_id
   left join lateral (
         select sv.value from similar_votes sv
          where sv.pair_id = c.pair_id and ($2::text is not null and sv.user_id::text = $2::text)
          limit 1
       ) me on true
       order by c.created_at asc, c.pair_id asc
    `, [mangaId, viewer]);

    const items = (rows || []).map((r: any) => ({
      id: Number(r.other_id),
      title: r.title ?? '',
      slug: null as string | null,
      poster_url: r.poster_url ?? null,
      likes: Number(r.likes || 0),
      dislikes: Number(r.dislikes || 0),
      votes: Number(r.likes || 0) + Number(r.dislikes || 0),
      avg_score: null,
      score_weighted: null,
      my_reaction: r.my_value === 1 ? 'up' : r.my_value === -1 ? 'down' : null,
    }));
    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}

/* POST */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const mangaId = toId(params.id);
  if (!mangaId) return NextResponse.json({ ok: false, message: 'Bad id' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const otherId = toId(body?.otherId);
  const actionRaw = String(body?.action ?? ''); // '', 'add', 'up', 'down', 'clear'

  const viewerRaw = await getViewerId(req).catch(() => null);
  if (viewerRaw == null) return NextResponse.json({ ok: false, message: 'UNAUTHORIZED' }, { status: 401 });
  const viewer = String(viewerRaw);

  if (!otherId || otherId === mangaId) {
    return NextResponse.json({ ok: false, message: 'Некорректный ID' }, { status: 400 });
  }

  try {
    // найти/создать пару
    const found = await query<{ id: number }>(
      `select id from similar_titles
        where (manga_id = $1 and other_id = $2) or (manga_id = $2 and other_id = $1)
        limit 1`, [mangaId, otherId]
    );
    let pairId = found.rows[0]?.id ?? null;

    if (!pairId) {
      const ins = await query<{ id: number }>(
        `insert into similar_titles (manga_id, other_id)
         values ($1, $2) on conflict (manga_id, other_id) do nothing returning id`,
        [mangaId, otherId]
      );
      pairId = ins.rows[0]?.id ?? null;

      if (!pairId) {
        const again = await query<{ id: number }>(
          `select id from similar_titles
             where (manga_id = $1 and other_id = $2) or (manga_id = $2 and other_id = $1)
             limit 1`, [mangaId, otherId]
        );
        pairId = again.rows[0]?.id ?? null;
      }
    }

    if (!pairId) return NextResponse.json({ ok: false, message: 'Не удалось создать/найти пару' }, { status: 500 });

    if (actionRaw === '' || actionRaw === 'add') return NextResponse.json({ ok: true, created: true });

    const existing = await query<{ value: number }>(
      `select value from similar_votes where pair_id = $1 and user_id = $2::uuid limit 1`,
      [pairId, viewer]
    );
    const oldVal = existing.rows[0]?.value ?? 0;

    await query('begin');
    if (actionRaw === 'clear') {
      if (oldVal !== 0) {
        await query(
          `update similar_titles
              set likes    = greatest(0, likes    - case when $1 = 1  then 1 else 0 end),
                  dislikes = greatest(0, dislikes - case when $1 = -1 then 1 else 0 end)
            where id = $2`, [oldVal, pairId]
        );
        await query(`delete from similar_votes where pair_id = $1 and user_id = $2::uuid`, [pairId, viewer]);
      }
    } else {
      const newVal = actionRaw === 'up' ? 1 : -1;
      await query(
        `insert into similar_votes (pair_id, user_id, value)
           values ($1, $2::uuid, $3)
         on conflict (pair_id, user_id) do update set value = excluded.value, updated_at = now()`,
        [pairId, viewer, newVal]
      );
      await query(
        `update similar_titles
           set likes    = greatest(0, likes    - case when $1 = 1  then 1 else 0 end
                                            + case when $2 = 1  then 1 else 0 end),
               dislikes = greatest(0, dislikes - case when $1 = -1 then 1 else 0 end
                                            + case when $2 = -1 then 1 else 0 end)
         where id = $3`,
        [oldVal, newVal, pairId]
      );
    }

    const after = await query<{ likes: number; dislikes: number }>(`select likes, dislikes from similar_titles where id = $1`, [pairId]);
    const likes = Number(after.rows[0]?.likes || 0);
    const dislikes = Number(after.rows[0]?.dislikes || 0);
    const score = likes - dislikes;

    if (score <= REMOVE_THRESHOLD) {
      await query(`delete from similar_titles where id = $1`, [pairId]);
      await query('commit');
      return NextResponse.json({ ok: true, removed: true });
    }

    await query('commit');
    return NextResponse.json({ ok: true, removed: false });
  } catch (e: any) {
    await query('rollback').catch(() => {});
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
