// app/api/profile/me/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { SESSION_COOKIE, verifySession } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const token = (await cookies()).get(SESSION_COOKIE)?.value || null;
    const sess = await verifySession(token);
    if (!sess?.sub) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const r = await query<{
      id: string;
      user_id: string | null;
      username: string | null;
      nickname: string | null;
      display_name: string | null;
      avatar_url: string | null;
      role: string | null;
      email: string | null;
    }>(
      `
      SELECT p.id, p.user_id, p.username, p.nickname, p.display_name, p.avatar_url, p.role, p.email
      FROM public.profiles p
      WHERE p.user_id = $1 OR p.id = $1
      LIMIT 1
      `,
      [sess.sub]
    );

    const profile = r.rows[0] || null;
    return NextResponse.json({ ok: true, profile });
  } catch (e: any) {
    console.error('[GET /api/profile/me] fatal:', e);
    return NextResponse.json({ ok: false, error: 'internal', message: e?.message }, { status: 500 });
  }
}
