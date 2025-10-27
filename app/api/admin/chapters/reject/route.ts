// app/api/admin/chapters/reject/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireModeratorAPI } from '@/lib/admin/api-guard';
import { logAdminAction } from '@/lib/admin/audit-log';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { userId: modId } = await requireModeratorAPI(req);

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ ok: false, message: 'Invalid JSON body' }, { status: 400 });
    }

    const chapterId = Number(body?.chapterId ?? 0);
    if (!chapterId) {
      return NextResponse.json({ ok: false, message: 'chapterId required' }, { status: 400 });
    }

    // Проверяем существование главы
    const { rows: chapterRows } = await query(
      `SELECT id, manga_id, status, pages_count 
       FROM chapters 
       WHERE id = $1`,
      [chapterId]
    );

    if (chapterRows.length === 0) {
      return NextResponse.json({ ok: false, message: 'Chapter not found' }, { status: 404 });
    }

    const chapterInfo = chapterRows[0];

    await query('BEGIN');

    try {
      // Удаляем страницы
      const { rowCount: deletedPages } = await query(
        `DELETE FROM chapter_pages WHERE chapter_id = $1`,
        [chapterId]
      );

      // Удаляем главу
      const { rowCount: deletedChapter } = await query(
        `DELETE FROM chapters WHERE id = $1`,
        [chapterId]
      );

      await query('COMMIT');

      // ✅ Пытаемся очистить R2 (non-critical)
      let r2Result = { attempted: false, deleted: 0 };
      try {
        const r2Module = await import('@/lib/r2');
        const stagingPrefix = `staging/manga/${chapterInfo.manga_id}/chapters/${chapterId}/`;
        const deleted = await r2Module.deletePrefix(stagingPrefix);
        r2Result = { attempted: true, deleted };
      } catch (r2Error) {
        console.warn('[REJECT] R2 cleanup failed (non-critical):', r2Error);
      }

      // ✅ Аудит
      await logAdminAction(modId, 'chapter_reject', String(chapterId), {
        ip: req.headers.get('x-forwarded-for')?.split(',')[0],
        manga_id: chapterInfo.manga_id,
        deletedPages
      });

      return NextResponse.json({
        ok: true,
        chapterId,
        db: { chapterDeleted: !!deletedChapter, deletedPages },
        r2: r2Result,
      });
    } catch (e) {
      await query('ROLLBACK');
      throw e;
    }
  } catch (err: any) {
    if (err instanceof Response) return err;
    console.error('[POST /api/admin/chapters/reject]:', err);
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}