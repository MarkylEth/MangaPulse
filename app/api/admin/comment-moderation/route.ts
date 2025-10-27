// app/api/admin/comment-moderation/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { requireModeratorAPI } from '@/lib/admin/api-guard';
import { logAdminAction } from '@/lib/admin/audit-log';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireModeratorAPI(req);

    const items: Array<{
      id: string;
      manga_id?: number | null;
      page_id?: number | null;
      created_at?: string;
      user_id?: string | null;
      comment: string;
      flags?: string[];
    }> = [];

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('[GET /api/admin/comment-moderation]:', err);
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId: modId } = await requireModeratorAPI(req);

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
    }

    const { id, action, reason } = body;
    if (!id || !action) {
      return NextResponse.json({ ok: false, error: 'id and action required' }, { status: 400 });
    }

    // TODO: выполнить UPDATE/DELETE в зависимости от action

    // ✅ Аудит - ПРАВИЛЬНАЯ СТРОКА
    await logAdminAction(modId, 'comment_moderation', id, {
      ip: req.headers.get('x-forwarded-for')?.split(',')[0],
      action,
      reason: reason || null,
    });

    return NextResponse.json({ ok: true, id, action, reason: reason ?? null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('[POST /api/admin/comment-moderation]:', err);
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}