import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit  = Math.min(100, Number(searchParams.get('limit')  ?? 20));
  const offset = Math.max(0,   Number(searchParams.get('offset') ?? 0));

  const rows = await sql`
    select
      manga_id as id,
      title,
      cover_url,
      status,
      rating,
      chapters_count,
      release_year,
      trend_score,
      last_event_at,
      manga_created_at
    from manga_trending_view
    order by trend_score desc, last_event_at desc
    limit ${limit} offset ${offset};
  `;

  return NextResponse.json({ data: rows });
}
