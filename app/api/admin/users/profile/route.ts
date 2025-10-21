// app/api/admin/users/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { queryAsUser } from '@/lib/db';
import { requireAdmin } from '@/lib/admin/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest) {
  const { userId } = await requireAdmin();

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const id = String(body?.id || '').trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 });
  }

  // Извлекаем все поля из body
  const username = String(body?.username ?? '').trim();
  const full_name = String(body?.full_name ?? '').trim();
  const email = String(body?.email ?? '').trim();
  const note = String(body?.note ?? '').trim();
  const display_name = String(body?.display_name ?? '').trim();
  const nickname = String(body?.nickname ?? '').trim();
  const bio = String(body?.bio ?? '').trim();
  const about_md = String(body?.about_md ?? '').trim();
  const avatar_url = String(body?.avatar_url ?? '').trim();
  const banner_url = String(body?.banner_url ?? '').trim();
  const telegram = String(body?.telegram ?? '').trim();
  const discord_url = String(body?.discord_url ?? '').trim();
  const vk_url = String(body?.vk_url ?? '').trim();
  const x_url = String(body?.x_url ?? '').trim();
  
  // Массивы и объекты
  const favorite_genres = Array.isArray(body?.favorite_genres) ? body.favorite_genres : [];
  const social_links = body?.social_links && typeof body.social_links === 'object' ? body.social_links : {};

  try {
    // Обновляем profiles
    const profileResult = await queryAsUser(
      `
      UPDATE public.profiles
      SET
        username = $1,
        full_name = $2,
        note = $3,
        display_name = $4,
        nickname = $5,
        bio = $6,
        about_md = $7,
        avatar_url = $8,
        banner_url = $9,
        telegram = $10,
        discord_url = $11,
        vk_url = $12,
        x_url = $13,
        favorite_genres = $14,
        social_links = $15,
        updated_at = NOW()
      WHERE id::text = $16
      RETURNING 
        id::text, username, full_name, display_name, nickname, 
        bio, about_md, avatar_url, banner_url, note,
        telegram, discord_url, vk_url, x_url, favorite_genres, social_links,
        updated_at
      `,
      [
        username || null,
        full_name || null,
        note || null,
        display_name || null,
        nickname || null,
        bio || null,
        about_md || null,
        avatar_url || null,
        banner_url || null,
        telegram || null,
        discord_url || null,
        vk_url || null,
        x_url || null,
        favorite_genres,
        JSON.stringify(social_links),
        id,
      ],
      userId
    );

    if (profileResult.rowCount === 0) {
      return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 404 });
    }

    // Обновляем email в users
    if (email) {
      try {
        await queryAsUser(
          `
          UPDATE public.users
          SET email = $1, updated_at = NOW()
          WHERE id::text = $2
          `,
          [email, id],
          userId
        );
      } catch (e) {
        console.warn('Failed to update email:', e);
      }
    }

    return NextResponse.json({
      ok: true,
      data: profileResult.rows[0],
    });
  } catch (e) {
    console.error('Update failed:', e);
    return NextResponse.json(
      {
        ok: false,
        error: 'update_failed',
        details: (e as Error).message,
      },
      { status: 500 }
    );
  }
}