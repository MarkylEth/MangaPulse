// app/api/admin/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireModeratorAPI } from '@/lib/admin/api-guard';
export const dynamic = 'force-dynamic';

async function safeCount(sql: string, params: any[] = []) {
  try {
    const { rows } = await query<{ c: string | number }>(
      `SELECT COALESCE((${sql}), 0) as c`,
      params
    );
    return Number(rows?.[0]?.c ?? 0);
  } catch (e) {
    console.error('safeCount failed:', e);
    return 0;
  }
}

export async function GET(req: NextRequest) {
  try {
    // ✅ Модератор или админ
    await requireModeratorAPI(req);

    const [
      users,
      manga,
      chapters,
      pending,
      drafts,
      today,
      comments,
    ] = await Promise.all([
      safeCount(`SELECT COUNT(*) FROM users`),
      safeCount(`SELECT COUNT(*) FROM manga`),
      safeCount(`SELECT COUNT(*) FROM chapters`),
      safeCount(`SELECT COUNT(*) FROM chapters WHERE LOWER(status) = 'ready'`),
      safeCount(`SELECT COUNT(*) FROM chapters WHERE LOWER(status) = 'draft'`),
      safeCount(`SELECT COUNT(*) FROM chapters WHERE DATE(created_at) = CURRENT_DATE`),
      safeCount(`SELECT COUNT(*) FROM manga_comments`),
    ]);

    return NextResponse.json({
      ok: true,
      stats: {
        users,
        manga,
        chapters,
        pendingChapters: pending,
        draftChapters: drafts,
        todayUploads: today,
        comments,
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('[GET /api/admin/stats]:', err);
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}
