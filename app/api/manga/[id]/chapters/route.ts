// app/api/manga/[id]/chapters/route.ts
import { NextResponse } from 'next/server';
import { getPublicChaptersByManga } from '@/lib/data/chapters';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const mangaId = Number(params.id);
  if (!Number.isFinite(mangaId)) return NextResponse.json({ ok: false, message: 'Bad id' }, { status: 400 });

  const u = new URL(req.url);
  const limit = Math.max(0, Math.min(500, Number(u.searchParams.get('limit') || 0)));
  try {
    const items = await getPublicChaptersByManga(mangaId, { limit, order: 'desc', by: 'created_at' });
    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? 'Internal error' }, { status: 500 });
  }
}
