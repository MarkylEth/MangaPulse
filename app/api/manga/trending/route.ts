// app/api/manga/trending/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Система трендов по принципу MangaLib:
 * - Учитывается активность за последние 7 дней
 * - Взвешенный скоринг по действиям пользователей
 * - Приоритет свежим и активно обновляемым тайтлам
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(100, Number(searchParams.get('limit') ?? 20));
    const offset = Math.max(0, Number(searchParams.get('offset') ?? 0));

    const rows = await sql`
      WITH trending_base AS (
        SELECT 
          m.id,
          m.title,
          m.cover_url,
          m.status,
          m.release_year,
          m.created_at,
          
          -- Базовые метрики
          COUNT(DISTINCT c.id) AS total_chapters,
          COALESCE(AVG(mr.rating), 0)::numeric(4,2) AS avg_rating,
          COUNT(mr.manga_id) AS total_ratings,
          
          -- Активность за 7 дней
          COUNT(DISTINCT CASE 
            WHEN c.created_at >= NOW() - INTERVAL '7 days' 
            THEN c.id 
          END) AS new_chapters_7d,
          
          COUNT(CASE 
            WHEN mr.created_at >= NOW() - INTERVAL '7 days' 
            THEN 1 
          END) AS new_ratings_7d,
          
          COUNT(CASE 
            WHEN uml.created_at >= NOW() - INTERVAL '7 days' 
            THEN 1 
          END) AS new_bookmarks_7d,
          
          MAX(GREATEST(
            COALESCE(c.created_at, m.created_at),
            COALESCE(mr.created_at, m.created_at)
          )) AS last_activity
          
        FROM manga m
        LEFT JOIN chapters c ON c.manga_id = m.id
        LEFT JOIN manga_ratings mr ON mr.manga_id = m.id
        LEFT JOIN user_manga_lists uml ON uml.manga_id = m.id
        
        WHERE m.status NOT IN ('deleted', 'draft')
        
        GROUP BY m.id, m.title, m.cover_url, m.status, m.release_year, m.created_at
      ),
      
      trending_scored AS (
        SELECT 
          *,
          -- MangaLib-style скоринг
          (
            -- Новые главы (максимальный вес)
            (new_chapters_7d * 10.0) +
            
            -- Новые оценки (высокий вес)
            (new_ratings_7d * 3.0) +
            
            -- Новые закладки (средний вес)
            (new_bookmarks_7d * 2.0) +
            
            -- Множитель за высокий рейтинг
            CASE 
              WHEN avg_rating >= 9.0 AND total_ratings >= 10 THEN 20.0
              WHEN avg_rating >= 8.0 AND total_ratings >= 5 THEN 10.0
              WHEN avg_rating >= 7.0 AND total_ratings >= 3 THEN 5.0
              ELSE 0
            END +
            
            -- Бонус за свежесть тайтла
            CASE 
              WHEN created_at >= NOW() - INTERVAL '30 days' THEN 15.0
              WHEN created_at >= NOW() - INTERVAL '90 days' THEN 8.0
              ELSE 0
            END +
            
            -- Бонус активным онгоингам
            CASE 
              WHEN status = 'ongoing' AND new_chapters_7d > 0 THEN 12.0
              WHEN status = 'ongoing' THEN 3.0
              ELSE 0
            END +
            
            -- Штраф за отсутствие активности
            CASE 
              WHEN last_activity < NOW() - INTERVAL '30 days' THEN -20.0
              WHEN last_activity < NOW() - INTERVAL '14 days' THEN -10.0
              ELSE 0
            END
            
          ) AS trend_score
          
        FROM trending_base
      )
      
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
        
      FROM trending_scored
      
      WHERE 
        -- Фильтр: должна быть реальная активность за 7 дней
        (new_chapters_7d > 0 OR new_ratings_7d > 0 OR new_bookmarks_7d > 0)
        AND trend_score > 0
        
      ORDER BY 
        trend_score DESC,
        last_activity DESC,
        avg_rating DESC
        
      LIMIT ${limit} OFFSET ${offset};
    `;

    return NextResponse.json({ 
      ok: true,
      data: rows,
      meta: {
        count: rows.length,
        algorithm: 'mangalib-style'
      }
    });
    
  } catch (e: any) {
    console.error('[trending] Error:', e);
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