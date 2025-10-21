// ============================================
// app/api/manga/trending/cached/route.ts
// БЫСТРАЯ версия с использованием MATERIALIZED VIEW
// ============================================

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(100, Number(searchParams.get('limit') ?? 20));
    const offset = Math.max(0, Number(searchParams.get('offset') ?? 0));

    // Простой SELECT из предвычисленного view
    const rows = await sql`
      SELECT 
        id,
        title,
        cover_url,
        status,
        avg_rating AS rating,
        total_chapters AS chapters_count,
        release_year,
        trend_score,
        last_activity AS last_event_at,
        created_at AS manga_created_at
      FROM manga_trending_cached
      WHERE trend_score > 0
      ORDER BY trend_score DESC, last_activity DESC
      LIMIT ${limit} OFFSET ${offset};
    `;

    return NextResponse.json({ 
      ok: true,
      data: rows,
      meta: {
        count: rows.length,
        cached: true
      }
    });
  } catch (e: any) {
    console.error('[trending cached] Error:', e);
    return NextResponse.json({ 
      ok: false, 
      error: e?.message ?? 'Internal error' 
    }, { status: 500 });
  }
}

// ============================================
// app/api/manga/new/cached/route.ts
// БЫСТРАЯ версия для новинок
// ============================================

export async function GET_NEW(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(100, Number(searchParams.get('limit') ?? 24));
    const offset = Math.max(0, Number(searchParams.get('offset') ?? 0));

    const rows = await sql`
      SELECT 
        id,
        title,
        cover_url,
        status,
        avg_rating AS rating,
        chapters_count,
        release_year,
        first_chapter_date AS newness_at,
        last_chapter_date AS last_event_at,
        created_at AS manga_created_at
      FROM manga_new_cached
      ORDER BY first_chapter_date DESC, avg_rating DESC
      LIMIT ${limit} OFFSET ${offset};
    `;

    return NextResponse.json({ 
      ok: true,
      data: rows,
      meta: {
        count: rows.length,
        cached: true
      }
    });
  } catch (e: any) {
    console.error('[new cached] Error:', e);
    return NextResponse.json({ 
      ok: false, 
      error: e?.message ?? 'Internal error' 
    }, { status: 500 });
  }
}

// ============================================
// app/api/admin/refresh-trends/route.ts
// API для обновления кэшей (вызывать по крону)
// ============================================

export async function POST_REFRESH(req: Request) {
  try {
    // Проверка админских прав здесь
    
    await sql`REFRESH MATERIALIZED VIEW CONCURRENTLY manga_trending_cached`;
    await sql`REFRESH MATERIALIZED VIEW CONCURRENTLY manga_new_cached`;
    
    return NextResponse.json({ 
      ok: true, 
      message: 'Views refreshed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (e: any) {
    console.error('[refresh] Error:', e);
    return NextResponse.json({ 
      ok: false, 
      error: e?.message ?? 'Internal error' 
    }, { status: 500 });
  }
}