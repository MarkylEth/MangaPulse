import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { resolveTeamBySlug } from '../_utils'

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  const team = await resolveTeamBySlug(params.slug)
  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 })

  const sql = `
    -- Считаем главы где team_id в массиве team_ids
    SELECT 
      COUNT(*) FILTER (
        WHERE LOWER(COALESCE(status, '')) = ANY(ARRAY['published','release','released','public','done','complete'])
           OR LOWER(COALESCE(review_status, '')) = ANY(ARRAY['approved','accept','accepted','ok'])
      )::INT AS translated_chapters,
      
      COALESCE(SUM(pages_count) FILTER (
        WHERE LOWER(COALESCE(status, '')) = ANY(ARRAY['published','release','released','public','done','complete'])
           OR LOWER(COALESCE(review_status, '')) = ANY(ARRAY['approved','accept','accepted','ok'])
      ), 0)::INT AS translated_pages,
      
      COUNT(*) FILTER (
        WHERE LOWER(COALESCE(status, '')) NOT IN ('published','release','released','public','done','complete')
          AND LOWER(COALESCE(review_status, '')) NOT IN ('approved','accept','accepted','ok')
      )::INT AS in_work
      
    FROM chapters
    WHERE $1 = ANY(team_ids) -- проверяем, что team.id есть в массиве team_ids
  `

  try {
    const r = await query(sql, [team.id])
    const row = r.rows[0] ?? { translated_chapters: 0, translated_pages: 0, in_work: 0 }
    
    return NextResponse.json({
      translated_chapters: Number(row.translated_chapters || 0),
      translated_pages:    Number(row.translated_pages || 0),
      in_work:             Number(row.in_work || 0),
    })
  } catch (e) {
    console.error('Team stats SQL failed:', e)
    return NextResponse.json({ 
      translated_chapters: 0, 
      translated_pages: 0, 
      in_work: 0 
    })
  }
}