// app/api/profile/by-username/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const u = searchParams.get('u');
  if (!u) {
    return NextResponse.json({ ok: false, error: 'u required' }, { status: 400 });
  }

  const rows = await sql<{
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    created_at: string | null;
    banner_url: string | null;
    favorite_genres: string[] | null;
    telegram: string | null;
    x_url: string | null;
    vk_url: string | null;
    discord_url: string | null;
  }>`
    SELECT
      id, username, full_name, avatar_url, bio, created_at, banner_url,
      favorite_genres, telegram, x_url, vk_url, discord_url
    FROM public.profiles
    WHERE LOWER(username) = LOWER(${u})
    LIMIT 1
  `;

  const profile = rows[0] ?? null;
  return NextResponse.json({ ok: true, profile });
}
