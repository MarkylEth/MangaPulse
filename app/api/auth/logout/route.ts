// app/api/auth/logout/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { assertOriginJSON } from '@/lib/csrf';
import { destroySession } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
  assertOriginJSON(req);
  const res = NextResponse.json({ ok: true });
  destroySession(res);
  return res;
}
