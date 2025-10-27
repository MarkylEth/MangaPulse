// app/api/user-library/route.ts
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSessionUser } from '@/lib/auth/session';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ========== GET: Получить библиотеку по username ========== */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    
    // ✅ Принимаем username вместо user_id
    const username = searchParams.get('username');
    
    if (!username) {
      return NextResponse.json({ error: 'username is required' }, { status: 400 });
    }

    // ✅ Находим user_id по username (UUID остаётся на сервере)
    const userQuery = await query(
      `SELECT id::text FROM public.users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
      [username]
    );

    if (userQuery.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = userQuery.rows[0].id; // UUID — только на сервере!

    // ✅ Получаем библиотеку
    const status = searchParams.get('status');
    const limit = Math.min(Number(searchParams.get('limit') ?? 48), 100);
    const offset = Math.max(Number(searchParams.get('offset') ?? 0), 0);

    const where: string[] = ['ul.user_id = $1'];
    const params: any[] = [userId];

    if (status) {
      where.push(`ul.status = $${params.length + 1}::read_status`);
      params.push(status);
    }

    const sql = `
      SELECT
        ul.manga_id,
        ul.status::text      as status,
        ul.is_favorite       as is_favorite,
        ul.created_at,
        ul.updated_at,
        m.id                 as m_id,
        m.title              as m_title,
        m.cover_url          as m_cover_url,
        m.author             as m_author,
        m.artist             as m_artist,
        m.status             as m_status
      FROM public.user_library ul
      LEFT JOIN public.manga m ON m.id = ul.manga_id
      WHERE ${where.join(' AND ')}
      ORDER BY COALESCE(ul.updated_at, ul.created_at) DESC NULLS LAST
      LIMIT $${params.push(limit)}
      OFFSET $${params.push(offset)}
    `;

    const { rows } = await query(sql, params);

    // ✅ НЕ включаем user_id в ответ!
    const data = rows.map(r => ({
      manga_id: r.manga_id,
      status: r.status,
      is_favorite: r.is_favorite,
      created_at: r.created_at,
      updated_at: r.updated_at,
      manga: {
        id: r.m_id,
        title: r.m_title,
        cover_url: r.m_cover_url,
        author: r.m_author,
        artist: r.m_artist,
        status: r.m_status,
      },
    }));

    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (e: any) {
    console.error('[GET /api/user-library]', e);
    return NextResponse.json(
      { error: e?.message || 'Failed to load library' },
      { status: 500 }
    );
  }
}

/* ========== PUT: Обновить библиотеку (только свою) ========== */
export async function PUT(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId: string = user.id;

    const body = await req.json().catch(() => ({}));
    const mangaId = Number(body?.manga_id);
    const rawStatus: string | null = typeof body?.status === 'string' ? body.status : null;
    const fav: boolean | null = typeof body?.is_favorite === 'boolean' ? body.is_favorite : null;

    if (!mangaId || Number.isNaN(mangaId)) {
      return NextResponse.json({ error: 'manga_id is required' }, { status: 400 });
    }

    const sql = `
      INSERT INTO public.user_library (user_id, manga_id, status, is_favorite)
      VALUES ($1, $2, COALESCE($3::read_status, 'reading'::read_status), COALESCE($4, false))
      ON CONFLICT (user_id, manga_id)
      DO UPDATE SET
        status      = COALESCE(EXCLUDED.status, user_library.status),
        is_favorite = COALESCE(EXCLUDED.is_favorite, user_library.is_favorite),
        updated_at  = NOW()
      RETURNING manga_id, status::text as status, is_favorite, created_at, updated_at
    `;

    const { rows } = await query(sql, [userId, mangaId, rawStatus, fav]);
    
    // ✅ НЕ возвращаем user_id
    return NextResponse.json({ ok: true, data: rows[0] }, { status: 200 });
  } catch (e: any) {
    console.error('[PUT /api/user-library]', e);
    return NextResponse.json(
      { error: e?.message || 'Failed to upsert' },
      { status: 500 }
    );
  }
}

/* ========== DELETE: Удалить из библиотеки (только свою) ========== */
export async function DELETE(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId: string = user.id;

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('manga_id');
    let body: any = null;
    try {
      body = await req.json();
    } catch {}
    const b = body?.manga_id;

    const mangaId = Number(b ?? q);
    if (!Number.isFinite(mangaId) || !mangaId) {
      return NextResponse.json({ error: 'manga_id is required' }, { status: 400 });
    }

    await query(
      `DELETE FROM public.user_library WHERE user_id = $1 AND manga_id = $2`,
      [userId, mangaId]
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    console.error('[DELETE /api/user-library]', e);
    return NextResponse.json(
      { error: e?.message || 'Failed to delete item' },
      { status: 500 }
    );
  }
}
