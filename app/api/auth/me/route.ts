// app/api/auth/me/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySession } from '@/lib/auth/session';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const token = (await cookies()).get(SESSION_COOKIE)?.value || null;
    const s = await verifySession(token);
    if (!s?.sub) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    // Только базовые данные пользователя из users
    const r = await query<{ id: string; email: string | null }>(
      `SELECT id, email FROM public.users WHERE id = $1 LIMIT 1`,
      [s.sub]
    );
    const u = r.rows?.[0];
    if (!u) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

    return NextResponse.json({
      ok: true,
      user: { id: u.id, email: u.email },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'internal' }, { status: 500 });
  }
}
