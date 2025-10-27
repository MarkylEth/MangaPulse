// app/api/admin/chapters/publish/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireModeratorAPI } from '@/lib/admin/api-guard';
import { logAdminAction } from '@/lib/admin/audit-log';
import { publishChapterToWasabi } from '@/lib/storage/publish';

export const dynamic = 'force-dynamic';

// API Key fallback для автоматизации
function allowByApiKey(req: NextRequest) {
  const k = req.headers.get('x-api-key')?.trim();
  return !!k && k === process.env.ADMIN_UPLOAD_KEY;
}

export async function POST(req: NextRequest) {
  try {
    let modId: string | null = null;

    if (!allowByApiKey(req)) {
      const { userId } = await requireModeratorAPI(req);
      modId = userId;
    }

    const body = await req.json().catch(() => ({}));
    const chapterId = Number(body?.chapterId ?? body?.id ?? 0);
    const deleteStaging = body?.deleteStaging !== false;

    if (!chapterId) {
      return NextResponse.json({ ok: false, message: 'chapterId required' }, { status: 400 });
    }

    const res = await publishChapterToWasabi(chapterId, { deleteStaging });

    // ✅ Аудит (если не через API key)
    if (modId) {
      await logAdminAction(modId, 'chapter_approve', String(chapterId), {
        ip: req.headers.get('x-forwarded-for')?.split(',')[0],
        deleteStaging
      });
    }

    return NextResponse.json({ ok: true, ...res });
  } catch (err: any) {
    if (err instanceof Response) return err;
    return NextResponse.json({ ok: false, message: String(err?.message || err) }, { status: 500 });
  }
}