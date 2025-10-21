// app/api/admin/users/security/revoke-sessions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { assertOriginJSON } from '@/lib/csrf';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/admin/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // CSRF-защита
  assertOriginJSON(req);
  
  await requireAdmin();
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || '').trim();
  if (!id) return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 });

  let total = 0;
  await query('BEGIN');
  try {
    // вариант 1: auth.sessions (рекомендуемое имя)
    const r1 = await query(`DELETE FROM auth.sessions WHERE user_id::text = $1`, [id]).catch(() => ({ rowCount: 0 }));
    total += r1.rowCount ?? 0;

    // вариант 2: public.sessions (если другая схема)
    const r2 = await query(`DELETE FROM public.sessions WHERE user_id::text = $1`, [id]).catch(() => ({ rowCount: 0 }));
    total += r2.rowCount ?? 0;

    await query('COMMIT');
    return NextResponse.json({ ok: true, revoked: total });
  } catch (e) {
    await query('ROLLBACK');
    return NextResponse.json({ ok: false, error: 'revoke_failed' }, { status: 500 });
  }
}