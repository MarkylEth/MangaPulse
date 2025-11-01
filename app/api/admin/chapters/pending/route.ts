// app/api/admin/chapters/pending/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireModeratorAPI } from '@/lib/admin/api-guard';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireModeratorAPI(req);

    const { rows } = await query(
      `
      SELECT
        c.id,
        c.manga_id,
        COALESCE(c.chapter_number, 0)                      AS chapter_number,
        COALESCE(c.vol_number, c.volume_number, c.volume)  AS volume,   -- нормализованный том
        c.vol_number,
        c.volume_number,
        COALESCE(c.title, '')                              AS title,
        LOWER(c.status)                                    AS status,
        COALESCE(c.pages_count, 0)                         AS pages_count,
        c.created_at,

        -- кто залил
        c.uploaded_by,
        c.user_id,
        c.created_by,
        u.username                                         AS uploader_name,

        -- инфо о тайтле
        m.title                                            AS manga_title,
        m.slug                                             AS manga_slug
      FROM chapters c
      JOIN manga m
        ON m.id = c.manga_id
      LEFT JOIN users u
        ON u.id = COALESCE(c.uploaded_by, c.user_id, c.created_by)
      WHERE LOWER(c.status) IN ('ready', 'draft')
        AND c.approved_by IS NULL
      ORDER BY c.created_at DESC
      LIMIT 200
      `
    );

    return NextResponse.json({ ok: true, items: rows });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}
