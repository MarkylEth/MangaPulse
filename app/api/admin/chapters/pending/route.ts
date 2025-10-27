// app/api/admin/chapters/pending/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireModeratorAPI } from '@/lib/admin/api-guard';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireModeratorAPI(req);

    const { rows } = await query(
      `SELECT
        c.id,
        c.manga_id,
        COALESCE(c.chapter_number, 0) as chapter_number,
        COALESCE(c.volume, 0) as volume,
        COALESCE(c.title, '') as title,
        LOWER(c.status) as status,
        COALESCE(c.pages_count, 0) as pages_count,
        c.created_at,
        m.title as manga_title,
        m.slug as manga_slug
       FROM chapters c
       JOIN manga m ON m.id = c.manga_id
       WHERE LOWER(c.status) IN ('ready', 'draft')
         AND c.approved_by IS NULL
       ORDER BY c.created_at DESC
       LIMIT 200`
    );

    return NextResponse.json({ ok: true, items: rows });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}