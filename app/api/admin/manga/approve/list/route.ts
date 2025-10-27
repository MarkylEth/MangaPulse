// app/api/admin/manga/approve/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireModeratorAPI } from '@/lib/admin/api-guard';
export const dynamic = 'force-dynamic';

/** GET: список тайтлов, ожидающих апрува */
export async function GET(req: NextRequest) {
  try {
    await requireModeratorAPI(req);

    // TODO: SELECT из таблицы заявок/буфера тайтлов до публикации
    const items: Array<{
      id: number | string;
      title: string;
      submitted_at?: string;
      author?: string | null;
      status?: 'pending' | 'approved' | 'rejected';
    }> = [];

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('[GET /api/admin/manga/approve/list]:', err);
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}
