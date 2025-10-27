// app/api/admin/manga/approve/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { requireModeratorAPI } from '@/lib/admin/api-guard';
import { logAdminAction } from '@/lib/admin/audit-log';
export const dynamic = 'force-dynamic';

/** POST: апрув конкретного тайтла */
export async function POST(req: NextRequest) {
  try {
    const { userId: modId } = await requireModeratorAPI(req);

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
    }

    const { id } = body;
    if (!id) {
      return NextResponse.json({ ok: false, error: 'id is required' }, { status: 400 });
    }

    // TODO: транзакция: перенести из стейджинга в публичную таблицу / обновить флаг
    // await withTx(async (cx) => { ... })

    // ✅ Аудит
    await logAdminAction(modId, 'manga_approve', id, {
      ip: req.headers.get('x-forwarded-for')?.split(',')[0],
    });

    return NextResponse.json({ ok: true, id });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('[POST /api/admin/manga/approve]:', err);
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}
