// app/api/admin/refresh/home/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  await sql`REFRESH MATERIALIZED VIEW CONCURRENTLY manga_trending_view;`;
  await sql`REFRESH MATERIALIZED VIEW CONCURRENTLY manga_new_view;`;
  return NextResponse.json({ ok: true });
}
