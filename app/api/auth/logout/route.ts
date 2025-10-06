// app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  await destroySession();           // ← стирает mp_session и legacy-имена
  return NextResponse.json({ ok: true });
}

export const GET = POST; // можно и GET дергать
