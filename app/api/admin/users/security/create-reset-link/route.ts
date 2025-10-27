// app/api/admin/users/security/create-reset-link/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { assertOriginJSON } from '@/lib/csrf';
import { randomBytes } from 'crypto';
import { query } from '@/lib/db';
import { requireAdminAPI } from '@/lib/admin/api-guard';
import { logAdminAction } from '@/lib/admin/audit-log';
import { checkRateLimit, getRateLimitInfo } from '@/lib/admin/rate-limit';

export async function POST(req: NextRequest) {
  assertOriginJSON(req);

  const { userId: adminId } = await requireAdminAPI(req, { allowSelfModify: false });

  if (!checkRateLimit(req)) {
    const info = getRateLimitInfo(req);
    const res = NextResponse.json(
      { ok: false, error: 'rate_limit_exceeded' },
      { status: 429 }
    );
    res.headers.set('X-RateLimit-Limit', String(info.limit));
    res.headers.set('X-RateLimit-Remaining', '0');
    res.headers.set('X-RateLimit-Reset', String(info.reset));
    res.headers.set('Retry-After', String(Math.max(0, Math.ceil((info.reset - Date.now()) / 1000))));
    return res;
  }

  const body = await req.json().catch(() => ({}));
  const targetUserId = String(body?.id || '').trim();

  if (!targetUserId) {
    return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 });
  }

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(targetUserId)) {
    return NextResponse.json({ ok: false, error: 'invalid_uuid' }, { status: 400 });
  }

  const { rows: targetRows } = await query<{ role: string | null }>(
    `SELECT COALESCE(role, 'user') AS role
       FROM profiles
      WHERE user_id = $1::uuid
      LIMIT 1`,
    [targetUserId]
  );

  if (targetRows[0]?.role === 'admin') {
    return NextResponse.json(
      { ok: false, error: 'cannot_reset_admin_password' },
      { status: 403 }
    );
  }

  const token = randomBytes(32).toString('hex');
  const ttlMinutes = 24 * 60;

  await query(`
    CREATE TABLE IF NOT EXISTS public.password_resets (
      id bigserial primary key,
      user_id uuid not null,
      token text not null unique,
      expires_at timestamptz not null,
      used_at timestamptz,
      created_by uuid,
      created_at timestamptz not null default now()
    );
  `);

  await query(
    `INSERT INTO public.password_resets (user_id, token, expires_at, created_by)
     VALUES ($1::uuid, $2, NOW() + INTERVAL '24 hours', $3::uuid)`,
    [targetUserId, token, adminId]
  );

  await logAdminAction(adminId, 'reset_password_link', targetUserId, {
    ip: req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || undefined,
    ttl_hours: 24,
  });

  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '';
  const url = baseUrl ? `${baseUrl}/auth/reset?token=${token}` : `/auth/reset?token=${token}`;

  return NextResponse.json(
    {
      ok: true,
      url,
      ttl_minutes: ttlMinutes,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
