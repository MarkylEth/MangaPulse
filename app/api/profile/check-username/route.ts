// app/api/profile/check-username/route.ts
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const u = (searchParams.get('u') || '').trim();
    const selfId = searchParams.get('self'); // это user_id из users

    // Валидация формата
    if (!/^[a-z0-9_]{3,20}$/.test(u)) {
      return NextResponse.json({ available: false, reason: 'bad_format' });
    }

    // ✅ ПРОВЕРЯЕМ В ТАБЛИЦЕ USERS, А НЕ PROFILES
    const sql = `
      SELECT 1
      FROM public.users
      WHERE LOWER(username) = LOWER($1)
        AND ($2::uuid IS NULL OR id <> $2::uuid)
      LIMIT 1
    `;

    const r = await query(sql, [u, selfId]);
    return NextResponse.json({ available: r.rowCount === 0 });
  } catch (e: any) {
    console.error('[check-username] Error:', e);
    return NextResponse.json(
      { available: false, error: e?.message ?? 'server_error' },
      { status: 500 }
    );
  }
}