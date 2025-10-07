import { ensureAdminAPI } from "@/lib/admin/api-guard";
// app/api/admin/manga/approve/list/route.ts
import { NextResponse } from 'next/server'
// import { many } from '@/lib/db'

/** GET: список тайтлов, ожидающих апрува (модерации) */
export async function GET() { const guard = await ensureAdminAPI(); if (guard) return guard;
  try {
    // TODO: SELECT из таблицы заявок/буфера тайтлов до публикации
    const items: Array<{
      id: number | string
      title: string
      submitted_at?: string
      author?: string | null
      status?: 'pending' | 'approved' | 'rejected'
    }> = []

    return NextResponse.json({ ok: true, items })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Internal error' }, { status: 500 })
  }
}

