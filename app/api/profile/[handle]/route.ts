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
    return NextResponse.json({ 
      ok: false, 
      error: 'bad_request' 
    }, { status: 400 });
  }

  try {
    const { rows } = await query(
      `SELECT * FROM public.profiles
       WHERE lower(username) = lower($1)
       LIMIT 1`,
      [handle]
    );

    const row = rows[0];
    
    // ✅ Даже если не найдено — возвращаем ok: true, но profile: null
    if (!row) {
      return NextResponse.json({ 
        ok: true, 
        data: { profile: null }  // ← НЕ ошибка, просто не найдено
      });
    }

    // ✅ Формируем объект профиля
    const profile = {
      id: String(row.id),
      username: row.username ?? handle,
      full_name: row.full_name ?? null,
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
    
  } catch (e: any) {
    console.error('[GET /api/profile/[handle]]', e);
    return NextResponse.json({
      ok: false,
      error: 'internal_error',
      message: e?.message,
    }, { status: 500 });
  }
}