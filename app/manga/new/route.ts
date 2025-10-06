import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ✅ именно GET — иначе будет 405
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit  = Math.min(100, Number(searchParams.get('limit')  ?? 24));
  const offset = Math.max(0,   Number(searchParams.get('offset') ?? 0));

  const rows = await sql`
    SELECT
      manga_id AS id,
      title,
      cover_url,
      status,
      rating,
      release_year,
      chapters_count,
      first_chapter_at,
      last_chapter_at,
      manga_created_at
    FROM manga_new_view
    ORDER BY manga_created_at DESC, last_chapter_at DESC
    LIMIT ${limit} OFFSET ${offset};
  `;

  return NextResponse.json({ data: rows });
}

// (не обязательно, но убирает лишние 405 на preflight)
export async function OPTIONS() {
  return NextResponse.json({ ok: true }, { headers: { Allow: 'GET, OPTIONS' } });
}
