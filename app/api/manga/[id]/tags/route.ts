// app/api/manga/[id]/tags/route.ts
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const mangaId = Number(params.id);
  if (!Number.isFinite(mangaId)) return NextResponse.json({ ok: false, message: 'Bad id' }, { status: 400 });

  try {
    const r = await query(`select tags from manga where id = $1 limit 1`, [mangaId]);
    const raw = r.rows?.[0]?.tags ?? null;
    const items: string[] = Array.isArray(raw)
      ? raw
      : typeof raw === 'string'
      ? raw.split(/[,\n;]+/g).map((s: string) => s.trim()).filter(Boolean)
      : [];
    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? 'Internal error' }, { status: 500 });
  }
}

