// app/api/chapters/update-teams/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { chapterId, teamIds } = body
    
    if (!chapterId) {
      return NextResponse.json({ error: 'chapterId required' }, { status: 400 })
    }
    
    if (!Array.isArray(teamIds) || teamIds.length === 0) {
      return NextResponse.json({ error: 'teamIds required' }, { status: 400 })
    }

    // Простой UPDATE с массивом
    await query(
      'UPDATE chapters SET team_ids = $1 WHERE id = $2',
      [teamIds, chapterId]
    )

    return NextResponse.json({ ok: true })
    
  } catch (error: any) {
    console.error('[update-teams] Error:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal error' },
      { status: 500 }
    )
  }
}