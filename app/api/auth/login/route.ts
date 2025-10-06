// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyPassword } from '@/lib/hash';
import { createSession } from '@/lib/auth/session'; // ← только это

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');

    if (!email || !password) {
      return NextResponse.json({ ok: false, error: 'missing_credentials' }, { status: 400 });
    }

    const r = await query<{
      id: string; email: string; name: string | null; password_hash: string | null;
    }>(
      `SELECT id, email, name, password_hash
         FROM public.users
        WHERE email = $1
        LIMIT 1`,
      [email]
    );

    const u = r.rows[0];
    if (!u?.password_hash) {
      return NextResponse.json({ ok: false, error: 'invalid_credentials' }, { status: 401 });
    }

    const ok = await verifyPassword(password, u.password_hash);
    if (!ok) {
      return NextResponse.json({ ok: false, error: 'invalid_credentials' }, { status: 401 });
    }

    // ← создаём сессию и кладём cookie (httpOnly) внутри функции
    await createSession(u.id);

    return NextResponse.json({
      ok: true,
      user: { id: u.id, email: u.email, name: u.name },
    });
  } catch (e: any) {
    console.error('[POST /api/auth/login] fatal:', e);
    return NextResponse.json({ ok: false, error: 'internal', message: e?.message }, { status: 500 });
  }
}
