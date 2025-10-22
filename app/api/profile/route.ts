// app/api/profile/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getSessionUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/* ========= helpers: валидация/нормализация ========= */
function validateUrl(url: unknown): string | null {
  const s = typeof url === 'string' ? url.trim() : '';
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

function sanitizeText(v: unknown, max = 200): string | null {
  if (typeof v !== 'string') return null;
  const cleaned = v.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if (!cleaned) return null;
  return cleaned.slice(0, max);
}

function normalizeTelegram(val: unknown): string | null {
  const s = typeof val === 'string' ? val.trim() : '';
  if (!s) return null;
  if (s.startsWith('@')) return s.slice(0, 64);
  try {
    const u = new URL(s);
    if ((u.hostname === 't.me' || u.hostname === 'telegram.me') && u.pathname.length > 1) {
      return `https://t.me${u.pathname}`.slice(0, 256);
    }
  } catch {}
  return null;
}

function normalizeDiscord(val: unknown): string | null {
  const s = typeof val === 'string' ? val.trim() : '';
  if (!s) return null;
  // Разрешаем username#1234 или инвайт-ссылку
  if (s.includes('#')) return s.slice(0, 64);
  try {
    const u = new URL(s);
    if (u.hostname.endsWith('discord.gg') || u.hostname.endsWith('discord.com')) {
      return u.toString().slice(0, 256);
    }
  } catch {}
  return null;
}

function normalizeX(val: unknown): string | null {
  const url = validateUrl(val);
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname === 'x.com' || u.hostname === 'twitter.com') return u.toString().slice(0, 256);
  } catch {}
  return null;
}

function normalizeVK(val: unknown): string | null {
  const url = validateUrl(val);
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname === 'vk.com' || u.hostname.endsWith('.vk.com')) return u.toString().slice(0, 256);
  } catch {}
  return null;
}

/* ==================== GET - свой профиль ==================== */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    // Если хочешь — можно расширить тут до bio/banner_url. Пока оставляю как у тебя.
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
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({} as any));

    // ----- username (если передан) -----
    const usernameProvided = Object.prototype.hasOwnProperty.call(body, 'username');
    const newUsername: string | undefined = usernameProvided ? body.username : undefined;
    if (usernameProvided) {
      if (typeof newUsername !== 'string' || !/^[a-z0-9_]{3,20}$/.test(newUsername)) {
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

    // ----- нормализация и валидация профильных полей -----
    // важный момент: различаем undefined (не трогаем в БД) и null (очистить поле)
    const display_name_provided = Object.prototype.hasOwnProperty.call(body, 'display_name');
    const display_name = display_name_provided ? sanitizeText(body.display_name, 80) : undefined;

    const bio_provided = Object.prototype.hasOwnProperty.call(body, 'bio');
    const bio = bio_provided ? sanitizeText(body.bio, 500) : undefined;

    const avatar_url_provided = Object.prototype.hasOwnProperty.call(body, 'avatar_url');
    const avatar_url = avatar_url_provided ? validateUrl(body.avatar_url) : undefined;

    const banner_url_provided = Object.prototype.hasOwnProperty.call(body, 'banner_url');
    const banner_url = banner_url_provided ? validateUrl(body.banner_url) : undefined;

    const x_url_provided = Object.prototype.hasOwnProperty.call(body, 'x_url');
    const x_url = x_url_provided ? normalizeX(body.x_url) : undefined;

    const vk_url_provided = Object.prototype.hasOwnProperty.call(body, 'vk_url');
    const vk_url = vk_url_provided ? normalizeVK(body.vk_url) : undefined;

    const telegram_provided = Object.prototype.hasOwnProperty.call(body, 'telegram');
    const telegram = telegram_provided ? normalizeTelegram(body.telegram) : undefined;

    const discord_url_provided = Object.prototype.hasOwnProperty.call(body, 'discord_url');
    const discord_url = discord_url_provided ? normalizeDiscord(body.discord_url) : undefined;

    const fav_genres_provided = Object.prototype.hasOwnProperty.call(body, 'favorite_genres');
    const favorite_genres: string[] | undefined = fav_genres_provided
      ? Array.isArray(body.favorite_genres)
        ? body.favorite_genres.filter((g: any) => typeof g === 'string').slice(0, 64)
        : []
      : undefined;

    await query('BEGIN');

    // 1) username (если меняем)
    if (usernameProvided && newUsername !== sessionUser.username) {
      try {
        await query(
          `UPDATE users SET username = $1, updated_at = NOW() WHERE id = $2`,
          [newUsername, sessionUser.id]
        );
      } catch (err: any) {
        await query('ROLLBACK');
        if (err?.code === '23505') {
          return NextResponse.json(
            { ok: false, error: 'username_taken', message: 'This username is already taken' },
            { status: 409 }
          );
        }
        throw err;
      }
    }

    // 2) гарантируем, что строка в profiles есть
    await query(
      `INSERT INTO profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [sessionUser.id]
    );

    // 3) собираем динамический UPDATE только по переданным полям
    const sets: string[] = [];
    const params: any[] = [];
    const push = (sql: string, val: any) => { params.push(val); sets.push(sql.replace(/\$(\d+)/g, () => `$${params.length}`)); };

    if (display_name_provided) push(`display_name = $1`, display_name);
    if (avatar_url_provided)  push(`avatar_url = $1`, avatar_url);
    if (bio_provided)         push(`bio = $1`, bio);
    if (banner_url_provided)  push(`banner_url = $1`, banner_url);
    if (fav_genres_provided)  push(`favorite_genres = $1::text[]`, favorite_genres ?? null);
    if (telegram_provided)    push(`telegram = $1`, telegram);
    if (x_url_provided)       push(`x_url = $1`, x_url);
    if (vk_url_provided)      push(`vk_url = $1`, vk_url);
    if (discord_url_provided) push(`discord_url = $1`, discord_url);

    if (sets.length > 0) {
      params.push(sessionUser.id);
      const sql = `
        UPDATE profiles
        SET ${sets.join(', ')}, updated_at = NOW()
        WHERE user_id = $${params.length}
        RETURNING *
      `;
      const res = await query(sql, params);
      if (res.rowCount === 0) {
        await query('ROLLBACK');
        return NextResponse.json({ ok: false, error: 'profile_not_found' }, { status: 404 });
      }
    }

    await query('COMMIT');

    // 4) Возвращаем свежие данные (users JOIN profiles)
    const { rows } = await query<{
      user_id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
      bio: string | null;
      banner_url: string | null;
      favorite_genres: string[] | null;
      telegram: string | null;
      x_url: string | null;
      vk_url: string | null;
      discord_url: string | null;
      created_at: string | null;
      updated_at: string | null;
    }>(
      `
      SELECT
        u.id::text as user_id,
        u.username,
        p.display_name,
        p.avatar_url,
        p.bio,
        p.banner_url,
        p.favorite_genres,
        p.telegram,
        p.x_url,
        p.vk_url,
        p.discord_url,
        p.created_at,
        p.updated_at
      FROM users u
      LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.id = $1
      LIMIT 1
      `,
      [sessionUser.id]
    );

    const row = rows[0];
    return NextResponse.json({
      ok: true,
      data: {
        profile: row
          ? {
              id: row.user_id,
              username: row.username,
              display_name: row.display_name,
              avatar_url: row.avatar_url,
              bio: row.bio,
              banner_url: row.banner_url,
              favorite_genres: row.favorite_genres ?? [],
              telegram: row.telegram,
              x_url: row.x_url,
              vk_url: row.vk_url,
              discord_url: row.discord_url,
              created_at: row.created_at,
              updated_at: row.updated_at,
            }
          : {
              id: sessionUser.id,
              username: usernameProvided ? newUsername! : sessionUser.username,
              display_name: null,
              avatar_url: null,
              bio: null,
              banner_url: null,
              favorite_genres: [],
              telegram: null,
              x_url: null,
              vk_url: null,
              discord_url: null,
              created_at: null,
              updated_at: null,
            },
      },
    });
  } catch (error: any) {
    try { await query('ROLLBACK'); } catch {}
    console.error('[PATCH /api/profile]', error);
    return NextResponse.json(
      { ok: false, error: 'server_error', message: error?.message ?? 'unknown' },
      { status: 500 }
    );
  }
}
