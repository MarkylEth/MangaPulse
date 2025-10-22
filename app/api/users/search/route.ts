// app/api/users/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSessionUser } from '@/lib/auth/session'

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const me = (await getSessionUser().catch(() => null)) as any;
    const meId: string | null = me?.id ? String(me.id) : null;

    const { searchParams } = new URL(req.url);
    const rawQ = (searchParams.get('q') || '').trim();
    const limitRaw = Number.parseInt(searchParams.get('limit') || '20', 10);
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 20, 1), 50);

    // экранируем % и _ чтобы ILIKE не «взрывался» на специальных символах
    const q = rawQ.replace(/[%_]/g, '\\$&');

    const sql = q
      ? `
        SELECT id::text AS id, username, full_name, avatar_url
          FROM public.profiles
         WHERE (
                $1 = '' -- пустой запрос
                OR full_name ILIKE '%' || $1 || '%' ESCAPE '\\'
                OR username  ILIKE '%' || $1 || '%' ESCAPE '\\'
                OR id::text  ILIKE '%' || $1 || '%' ESCAPE '\\'
               )
           AND ($2 IS NULL OR id::text <> $2)
         ORDER BY full_name NULLS LAST, username NULLS LAST, id ASC
         LIMIT $3
      `
      : `
        SELECT id::text AS id, username, full_name, avatar_url
          FROM public.profiles
         WHERE ($1 IS NULL OR id::text <> $1)
         ORDER BY full_name NULLS LAST, username NULLS LAST, id ASC
         LIMIT $2
      `;

    const params = q ? [q, meId, limit] : [meId, limit];
    const { rows } = await query<{
      id: string; username: string | null; full_name: string | null; avatar_url: string | null;
    }>(sql, params);

    return NextResponse.json({ ok: true, items: rows }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || 'search_failed' },
      { status: 500 }
    );
  }
}
