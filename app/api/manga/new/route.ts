// app/api/manga/new/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Новинки по принципу MangaLib:
 * - Показываются тайтлы с первой главой за последние 30-90 дней
 * - Сортировка по дате первой главы (не по created_at манги)
 * - Фильтрация по минимальному количеству глав
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(100, Number(searchParams.get('limit') ?? 24));
    const offset = Math.max(0, Number(searchParams.get('offset') ?? 0));
    const days = Math.min(180, Number(searchParams.get('days') ?? 90)); // период для новинок

    const rows = await sql`
      WITH manga_first_chapter AS (
        SELECT 
          manga_id,
          MIN(created_at) AS first_chapter_date,
          COUNT(*) AS chapters_count
        FROM chapters
        GROUP BY manga_id
      ),
      
      new_releases AS (
        SELECT 
          m.id,
          m.title,
          m.cover_url,
          m.status,
          m.release_year,
          m.created_at,
          
          mfc.first_chapter_date,
          mfc.chapters_count,
          
          -- Средний рейтинг
          COALESCE(AVG(mr.rating), 0)::numeric(4,2) AS avg_rating,
          COUNT(mr.manga_id) AS rating_count,
          
          -- Последняя глава
          MAX(c.created_at) AS last_chapter_date,
          
          -- Скоринг для новинок (чем свежее первая глава, тем выше)
          EXTRACT(EPOCH FROM (NOW() - mfc.first_chapter_date)) / 86400.0 AS days_since_first_chapter
          
        FROM manga m
        INNER JOIN manga_first_chapter mfc ON mfc.manga_id = m.id
        LEFT JOIN chapters c ON c.manga_id = m.id
        LEFT JOIN manga_ratings mr ON mr.manga_id = m.id
        
        WHERE 
          m.status NOT IN ('deleted', 'draft')
          -- Фильтр: первая глава была опубликована в заданный период
          AND mfc.first_chapter_date >= NOW() - INTERVAL '${days} days'
          AND mfc.first_chapter_date <= NOW()
          -- Минимум 1 глава (уже есть в условии INNER JOIN)
          
        GROUP BY 
          m.id, m.title, m.cover_url, m.status, m.release_year, m.created_at,
          mfc.first_chapter_date, mfc.chapters_count
      )
      
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
        created_at AS manga_created_at,
        days_since_first_chapter
        
      FROM new_releases
      
      ORDER BY 
        first_chapter_date DESC,  -- Сначала самые свежие
        avg_rating DESC,          -- Затем по рейтингу
        chapters_count DESC       -- Затем по количеству глав
        
      LIMIT ${limit} OFFSET ${offset};
    `;

    return NextResponse.json({ 
      ok: true,
      data: rows,
      meta: {
        period_days: days,
        count: rows.length,
        algorithm: 'mangalib-style-new'
      }
    });
    
  } catch (e: any) {
    console.error('[new releases] Error:', e);
    return NextResponse.json({ 
      ok: false, 
      error: e?.message ?? 'Internal error' 
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return NextResponse.json({ ok: true }, { 
    headers: { 
      Allow: 'GET, OPTIONS',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    } 
  });
}
