// app/api/admin/users/security/create-reset-link/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { assertOriginJSON } from '@/lib/csrf';
import { randomBytes } from 'crypto';
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

  const token = randomBytes(32).toString('hex');
  const expiresMins = Number(body?.ttl_minutes ?? 24 * 60);
  const ttl = Math.max(15, Math.min(expiresMins, 60 * 24 * 7)); // 15 мин — 7 дней

  await query(`
    CREATE TABLE IF NOT EXISTS public.password_resets (
      id bigserial primary key,
      user_id uuid not null,
      token text not null unique,
      expires_at timestamptz not null,
      used_at timestamptz,
      created_at timestamptz not null default now()
    );
  `);

  const { rowCount } = await query(
    `INSERT INTO public.password_resets(user_id, token, expires_at)
     VALUES ($1::uuid, $2, NOW() + ($3 || ' minutes')::interval)`,
    [id, token, ttl]
  );

  if (!rowCount) {
    return NextResponse.json({ ok: false, error: 'insert_failed' }, { status: 500 });
  }

  // Ссылку подстрой под твой роут страницы сброса
  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '';
  const url = baseUrl ? `${baseUrl}/auth/reset?token=${token}` : `/auth/reset?token=${token}`;

  return NextResponse.json({ ok: true, token, url, ttl_minutes: ttl }, { headers: { 'Cache-Control': 'no-store' } });
}