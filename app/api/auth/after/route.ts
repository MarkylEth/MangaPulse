// app/api/auth/after/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { signSession, setSessionCookieOn } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await auth();
  const redirectTo = req.nextUrl.searchParams.get('redirect_to') || '/';
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/auth?error=unauthorized', req.nextUrl.origin));
  }

  const token = await signSession({
    sub: session.user.id,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
  });

  const res = NextResponse.redirect(new URL(redirectTo, req.nextUrl.origin));
  setSessionCookieOn(res, token);
  return res;
}
                                