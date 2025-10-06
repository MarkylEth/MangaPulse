import { NextResponse, type NextRequest } from 'next/server'
import { query } from '@/lib/db'
import { getAuthUser } from '@/lib/auth/route-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

type Ctx = { params: { id: string } } // <- не Promise

async function ensureRelationTables() {
  await query(`
    create table if not exists manga_relations (
      id bigserial primary key,
      manga_id int not null references manga(id) on delete cascade,
      related_manga_id int not null references manga(id) on delete cascade,
      relation_type text not null,
      created_at timestamptz not null default now(),
      unique (manga_id, related_manga_id, relation_type)
    );
  `)
  await query(`create index if not exists idx_manga_relations_manga on manga_relations(manga_id)`)
  await query(`create index if not exists idx_manga_relations_related on manga_relations(related_manga_id)`)

  
  await query(`
    create unique index if not exists manga_relations_sym_uq
    on manga_relations (
      least(manga_id, related_manga_id),
      greatest(manga_id, related_manga_id),
      relation_type
    )
  `)

  await query(`
    create table if not exists manga_links (
      id bigserial primary key,
      manga_id int not null references manga(id) on delete cascade,
      relation_type text null,
      target_title text not null,
      target_cover text null,
      kind text null,       -- 'anime' | 'external' | null
      url text not null,
      created_at timestamptz not null default now()
    );
  `)
  await query(`create index if not exists idx_manga_links_manga on manga_links(manga_id)`)
  await query(`create unique index if not exists manga_links_uq on manga_links(manga_id, url)`)
}

function isValidHttpUrl(u: string) {
  try {
    const url = new URL(u)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch { return false }
}

/* ========== GET: связанное ========== */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const mangaId = Number(params.id?.match(/^\d+/)?.[0] ?? NaN)
  if (!Number.isFinite(mangaId)) {
    // можно вернуть пусто, чтобы виджет не "краснел"
    return NextResponse.json({ ok: true, items: [] }, { status: 200 })
  }

  try {
    await ensureRelationTables()

    const relR = await query(`
      select r.id, r.relation_type, m.id as target_id, m.title as target_title, m.cover_url as target_cover
      from manga_relations r
      join manga m on m.id = r.related_manga_id
      where r.manga_id = $1
      order by r.created_at desc
    `, [mangaId])

    const linkR = await query(`
      select id, relation_type, target_title, target_cover, kind, url, created_at
      from manga_links
      where manga_id = $1
      order by created_at desc
    `, [mangaId])

    const items = [
      ...(relR.rows ?? []).map(x => ({
        id: `manga:${x.id}`,
        type: 'manga' as const,
        relation: x.relation_type as string | null,
        target_id: Number(x.target_id),
        title: String(x.target_title),
        cover_url: (x.target_cover as string | null) ?? null,
        url: `/manga/${x.target_id}`,
        kind: 'manga' as const,
      })),
      ...(linkR.rows ?? []).map(x => ({
        id: `link:${x.id}`,
        type: 'link' as const,
        relation: (x as any).relation_type as string | null,
        target_id: null as number | null,
        title: String((x as any).target_title),
        cover_url: ((x as any).target_cover as string | null) ?? null,
        url: String((x as any).url),
        kind: (((x as any).kind as string | null) ?? 'external') as 'anime' | 'external',
      })),
    ]

    return NextResponse.json({ ok: true, items }, { status: 200 })
  } catch (e: any) {
    console.error('relations GET failed:', e)
    return NextResponse.json({ ok: false, error: e?.message ?? 'Internal error' }, { status: 500 })
  }
}

/* ========== POST: добавить связь/ссылку ========== */
export async function POST(req: NextRequest, { params }: Ctx) {
  const mangaId = Number(params.id?.match(/^\d+/)?.[0] ?? NaN)

  try {
    if (!Number.isFinite(mangaId)) {
      return NextResponse.json({ ok: false, error: 'Bad manga id' }, { status: 400 })
    }

    const me = await getAuthUser(req)
    const role = me?.role ?? 'user'
    if (role !== 'moderator' && role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
    }

    await ensureRelationTables()

    const body = await req.json().catch(() => ({}))
    const targetType = String(body?.target_type || '').toLowerCase()

    if (targetType === 'manga') {
      const rel = String(body?.relation || 'related').toLowerCase()
      const targetId = Number(body?.target_id ?? NaN)

      if (!Number.isFinite(targetId) || targetId <= 0) {
        return NextResponse.json({ ok: false, error: 'Bad target_id' }, { status: 400 })
      }
      if (targetId === mangaId) {
        return NextResponse.json({ ok: false, error: 'Self relation is not allowed' }, { status: 400 })
      }

      // без ошибок внешнего ключа: вставляем только если цель существует
      const ins = await query(
        `insert into manga_relations (manga_id, related_manga_id, relation_type)
         select $1, $2, $3
         where exists (select 1 from manga where id = $2)
         on conflict do nothing
         returning id`,
        [mangaId, targetId, rel]
      )

      if ((ins.rowCount ?? 0) === 0) {
        return NextResponse.json({ ok: false, error: 'target_not_found_or_duplicate' }, { status: 400 })
      }

      return NextResponse.json({ ok: true, id: ins.rows[0].id }, { status: 200 })
    }

    if (targetType === 'link') {
      const title = String(body?.title || '').trim()
      const url = String(body?.url || '').trim()
      const cover = body?.cover_url ? String(body.cover_url).trim() : null
      const kind = body?.kind ? String(body.kind).trim() : null // 'anime' | 'external'
      const relation = body?.relation ? String(body.relation).trim().toLowerCase() : null

      if (!title || !url) {
        return NextResponse.json({ ok: false, error: 'Title and url are required' }, { status: 400 })
      }
      if (!isValidHttpUrl(url)) {
        return NextResponse.json({ ok: false, error: 'invalid_url' }, { status: 400 })
      }

      const ins = await query(
        `insert into manga_links (manga_id, relation_type, target_title, target_cover, kind, url)
         values ($1,$2,$3,$4,$5,$6)
         on conflict (manga_id, url) do nothing
         returning id`,
        [mangaId, relation, title, cover, kind, url]
      )

      return NextResponse.json(
        { ok: true, id: ins.rows[0]?.id ?? null, dedup: (ins.rowCount ?? 0) === 0 },
        { status: 200 }
      )
    }

    return NextResponse.json({ ok: false, error: 'Bad target_type' }, { status: 400 })
  } catch (e: any) {
    console.error('relations POST failed:', e)
    return NextResponse.json({ ok: false, error: e?.message ?? 'Internal error' }, { status: 500 })
  }
}
