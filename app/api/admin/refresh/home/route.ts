// app/api/admin/refresh/trending/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAPI } from '@/lib/admin/api-guard';
import { logAdminAction } from '@/lib/admin/audit-log';
import { query } from '@/lib/db';
export const dynamic = 'force-dynamic';

// Rate limiting: только 1 refresh каждые 5 минут
const RATE_LIMIT_MS = 5 * 60 * 1000;
let lastRefreshTime = 0;

export async function POST(req: NextRequest) {
  try {
    // ✅ Защита - только админы
    const { userId: adminId } = await requireAdminAPI(req);

    // ✅ Rate limiting
    const now = Date.now();
    if (now - lastRefreshTime < RATE_LIMIT_MS) {
      const waitSeconds = Math.ceil((RATE_LIMIT_MS - (now - lastRefreshTime)) / 1000);
      return NextResponse.json(
        {
          ok: false,
          error: 'rate_limit',
          message: `Please wait ${waitSeconds} seconds before refreshing again`,
          retryAfter: waitSeconds,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(waitSeconds) },
        }
      );
    }

    // ✅ Логируем ПЕРЕД выполнением
    await logAdminAction(adminId, 'cache_refresh', null, {
      ip: req.headers.get('x-forwarded-for')?.split(',')[0],
      type: 'trending_view'
    });

    const startTime = Date.now();

    // Обновляем представление
    await query(`REFRESH MATERIALIZED VIEW CONCURRENTLY manga_trending_view`);

    const duration = Date.now() - startTime;
    lastRefreshTime = now;

    return NextResponse.json({
      ok: true,
      message: 'Trending view refreshed successfully',
      duration_ms: duration,
      next_available_in: RATE_LIMIT_MS / 1000,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('[POST /api/admin/refresh/trending]:', err);
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}
