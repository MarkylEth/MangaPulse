// app/api/chapters/debug/route.ts
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { rows } = await query(`
    select chapter_id, manga_id, manga_title, chapter_number, volume,
           created_at, cover_url, team_name, team_slug
      from chapter_feed_view
     order by created_at desc
     limit 25
  `);
  return NextResponse.json(rows); // без оболочки, для простоты
}

