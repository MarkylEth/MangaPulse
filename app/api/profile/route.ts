// app/api/profile/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getSessionUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/* ==================== GET - получить свой профиль ==================== */
export async function GET() {
  try {
    const user = await getSessionUser();
    
    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'unauthorized' },
        { status: 401 }
      );
    }

    // ✅ Профиль уже загружен в getSessionUser()
    return NextResponse.json({
      ok: true,
      data: {
        profile: {
          id: user.id,
          username: user.username,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          role: user.role,
        },
      },
    });
  } catch (error: any) {
    console.error('[GET /api/profile]', error);
    return NextResponse.json(
      { ok: false, error: 'internal_error', message: error?.message },
      { status: 500 }
    );
  }
}

/* ==================== PATCH - обновить профиль ==================== */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getSessionUser();
    
    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      username,
      display_name,
      avatar_url,
      bio,
      banner_url,
      favorite_genres,
      telegram,
      x_url,
      vk_url,
      discord_url,
    } = body || {};

    // ✅ Валидация username (если передан)
    if (username !== undefined) {
      if (typeof username !== 'string' || !/^[a-z0-9_]{3,20}$/.test(username)) {
        return NextResponse.json(
          {
            ok: false,
            error: 'invalid_username',
            message: 'Username must be 3-20 characters: a-z, 0-9, underscore only',
          },
          { status: 400 }
        );
      }
    }

    // ✅ Нормализация жанров
    const genres = Array.isArray(favorite_genres) ? favorite_genres : [];

    await query('BEGIN');

    // ✅ 1) Обновляем username в users (если передан)
    if (username !== undefined && username !== user.username) {
      try {
        await query(
          `UPDATE users SET username = $1 WHERE id = $2`,
          [username, user.id]
        );
      } catch (error: any) {
        await query('ROLLBACK');
        
        // Обрабатываем конфликт unique constraint
        if (error?.code === '23505') {
          return NextResponse.json(
            {
              ok: false,
              error: 'username_taken',
              message: 'This username is already taken',
            },
            { status: 409 }
          );
        }
        
        throw error;
      }
    }

    // ✅ 2) Обновляем profiles
    const updateResult = await query(
      `UPDATE profiles
       SET
         display_name = COALESCE($2, display_name),
         avatar_url = COALESCE($3, avatar_url),
         bio = $4,
         banner_url = $5,
         favorite_genres = $6::text[],
         telegram = $7,
         x_url = $8,
         vk_url = $9,
         discord_url = $10,
         updated_at = NOW()
       WHERE user_id = $1
       RETURNING *`,
      [
        user.id,
        display_name ?? null,
        avatar_url ?? null,
        bio ?? null,
        banner_url ?? null,
        genres,
        telegram ?? null,
        x_url ?? null,
        vk_url ?? null,
        discord_url ?? null,
      ]
    );

    if (updateResult.rowCount === 0) {
      await query('ROLLBACK');
      return NextResponse.json(
        { ok: false, error: 'profile_not_found' },
        { status: 404 }
      );
    }

    await query('COMMIT');

    // ✅ 3) Возвращаем обновлённый профиль с username из users
    const finalUsername = username !== undefined ? username : user.username;
    const updatedProfile = updateResult.rows[0];

    return NextResponse.json({
      ok: true,
      data: {
        profile: {
          id: user.id,
          username: finalUsername,
          display_name: updatedProfile.display_name,
          avatar_url: updatedProfile.avatar_url,
          bio: updatedProfile.bio,
          banner_url: updatedProfile.banner_url,
          favorite_genres: updatedProfile.favorite_genres,
          telegram: updatedProfile.telegram,
          x_url: updatedProfile.x_url,
          vk_url: updatedProfile.vk_url,
          discord_url: updatedProfile.discord_url,
          created_at: updatedProfile.created_at,
          updated_at: updatedProfile.updated_at,
        },
      },
    });
  } catch (error: any) {
    try {
      await query('ROLLBACK');
    } catch {}

    console.error('[PATCH /api/profile]', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'server_error',
        message: error?.message ?? 'unknown',
      },
      { status: 500 }
    );
  }
}