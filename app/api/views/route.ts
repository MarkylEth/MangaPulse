// app/api/views/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getIp } from '@/lib/net/ip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function ok(data: unknown, init: number | ResponseInit = 200) {
  return NextResponse.json(data, typeof init === 'number' ? { status: init } : init);
}

async function ensureTable() {
  // Если у тебя есть миграции — можешь убрать это создание таблицы.
  await query(`
    create table if not exists page_views(
      slug  text not null,
      day   date not null,
      ip    inet not null,
      ua    text,
      views int  not null default 1,
      primary key (slug, day, ip)
    );
  `);
}

async function bump(slug: string, req: NextRequest) {
  const ip = getIp(req) || '0.0.0.0';
  const ua = req.headers.get('user-agent') || '';
  await query(
    `insert into page_views(slug, day, ip, ua, views)
     values ($1, current_date, $2::inet, $3, 1)
     on conflict (slug, day, ip) do update set views = page_views.views + 1`,
    [slug, ip, ua]
  );
}

async function total(slug: string): Promise<number> {
  const { rows } = await query<{ total: number }>(
    `select coalesce(sum(views),0)::int as total from page_views where slug = $1`,
    [slug]
  );
  return rows[0]?.total ?? 0;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug')?.trim();
    const inc  = searchParams.get('inc');

    if (!slug) return ok({ error: 'bad_request', message: 'slug required' }, 400);

    await ensureTable();
    if (inc === '1') await bump(slug, req);

    return ok({ ok: true, slug, views: await total(slug) });
  } catch (e) {
    console.error('GET /api/views failed:', e);
    return ok({ error: 'internal' }, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { slug } = (await req.json().catch(() => ({}))) as { slug?: string };
    if (!slug) return ok({ error: 'bad_request', message: 'slug required' }, 400);

    await ensureTable();
    await bump(slug, req);

    return ok({ ok: true, slug, views: await total(slug) });
  } catch (e) {
    console.error('POST /api/views failed:', e);
    return ok({ error: 'internal' }, 500);
  }
}
