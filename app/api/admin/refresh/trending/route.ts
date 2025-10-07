import { ensureAdminAPI } from "@/lib/admin/api-guard";
// app/api/admin/refresh/trending/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() { const guard = await ensureAdminAPI(); if (guard) return guard;
  await sql`REFRESH MATERIALIZED VIEW CONCURRENTLY manga_trending_view;`;
  return NextResponse.json({ ok: true });
}

