// app/api/profile/[handle]/route.ts
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { handle: string } }
) {
  const handle = decodeURIComponent(params.handle || '').trim();
  
  if (!handle) {
    return NextResponse.json(
      { ok: false, error: 'bad_request' },
      { status: 400 }
    );
  }

  try {
    // ✅ ОПТИМИЗАЦИЯ: Один запрос вместо двух (JOIN users + profiles)
    const { rows } = await query<{
      user_id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
      bio: string | null;
      created_at: string | null;
      banner_url: string | null;
      favorite_genres: string[] | null;
      telegram: string | null;
      x_url: string | null;
      vk_url: string | null;
      discord_url: string | null;
    }>(
      `SELECT 
        u.id as user_id,
        u.username,
        p.display_name,
        p.avatar_url,
        p.bio,
        p.created_at,
        p.banner_url,
        p.favorite_genres,
        p.telegram,
        p.x_url,
        p.vk_url,
        p.discord_url
      FROM users u
      LEFT JOIN profiles p ON p.user_id = u.id
      WHERE LOWER(u.username) = LOWER($1)
      LIMIT 1`,
      [handle]
    );

    const row = rows[0];
    
    // ✅ Единый формат { ok, data: { profile } }
    if (!row) {
      return NextResponse.json({
        ok: true,
        data: { profile: null },
      });
    }

    // ✅ Формируем профиль
    const profile = {
      id: String(row.user_id),
      username: row.username ?? handle,
      display_name: row.display_name ?? null,
      avatar_url: row.avatar_url ?? null,
      bio: row.bio ?? null,
      created_at: row.created_at ?? null,
      banner_url: row.banner_url ?? null,
      favorite_genres: Array.isArray(row.favorite_genres) ? row.favorite_genres : null,
      telegram: row.telegram ?? null,
      x_url: row.x_url ?? null,
      vk_url: row.vk_url ?? null,
      discord_url: row.discord_url ?? null,
    };

    return NextResponse.json({
      ok: true,
      data: { profile },
    });
    
  } catch (error: any) {
    console.error('[GET /api/profile/[handle]]', error);
    return NextResponse.json({
      ok: false,
      error: 'internal_error',
      message: error?.message,
    }, { status: 500 });
  }
}