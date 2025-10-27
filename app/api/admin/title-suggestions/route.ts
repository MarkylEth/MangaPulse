// app/api/admin/title-suggestions/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { requireModeratorAPI } from '@/lib/admin/api-guard';
export const dynamic = 'force-dynamic';

/** GET: список подсказок/кандидатов в тайтлы */
export async function GET(req: NextRequest) {
  try {
    await requireModeratorAPI(req);

    // TODO: SELECT из таблицы title_suggestions (если есть) или вернуть пусто
    const items: Array<{
      id: number | string;
      title: string;
      source?: string | null;
      created_at?: string;
    }> = [];

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('[GET /api/admin/title-suggestions]:', err);
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}
