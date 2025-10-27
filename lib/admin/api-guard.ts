// lib/admin/api-guard.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSessionToken, verifySession } from '@/lib/auth/session';
import { query } from '@/lib/db';

type Role = 'admin' | 'moderator' | 'user';

type GuardRow = {
  role: Role;
  is_banned: boolean;
};

type AdminGuardOptions = {
  allowSelfModify?: boolean;
  requireSuperAdmin?: boolean;
};

/**
 * ✅ Единая проверка роли и бана из БД
 */
async function readRoleAndBan(userId: string): Promise<GuardRow | null> {
  const { rows } = await query<GuardRow>(
    `SELECT 
      COALESCE(p.role, 'user') as role,
      EXISTS(
        SELECT 1 FROM user_bans 
        WHERE user_id = $1::uuid 
        AND (expires_at IS NULL OR expires_at > NOW())
      ) as is_banned
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE u.id = $1::uuid
     LIMIT 1`,
    [userId]
  );

  return rows[0] ?? null;
}

/**
 * ✅ Общая проверка токена и состояния пользователя
 */
async function ensureUserAllowed(minRole: 'moderator' | 'admin') {
  const token = await getSessionToken();
  const payload = await verifySession(token);

  if (!payload?.sub) {
    throw new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
  }

  const row = await readRoleAndBan(payload.sub);

  if (!row) {
    throw new Response(JSON.stringify({ ok: false, error: 'not_found' }), { status: 401 });
  }

  if (row.is_banned) {
    throw new Response(JSON.stringify({ ok: false, error: 'banned' }), { status: 403 });
  }

  if (minRole === 'admin') {
    if (row.role !== 'admin') {
      throw new Response(JSON.stringify({ ok: false, error: 'forbidden' }), { status: 403 });
    }
  } else {
    if (row.role !== 'admin' && row.role !== 'moderator') {
      throw new Response(JSON.stringify({ ok: false, error: 'forbidden' }), { status: 403 });
    }
  }

  return { userId: payload.sub, role: row.role };
}

/**
 * ✅ Требует роль admin для API эндпоинта
 */
export async function requireAdminAPI(
  req: NextRequest,
  options?: AdminGuardOptions
): Promise<{ userId: string; role: 'admin' }> {
  try {
    const { userId, role } = await ensureUserAllowed('admin');

    if (!options?.allowSelfModify) {
      await checkSelfModify(req, userId);
    }

    return { userId, role: 'admin' };
  } catch (err) {
    if (err instanceof Response) throw err;
    throw new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
  }
}

/**
 * ✅ Требует роль moderator или admin для API эндпоинта
 */
export async function requireModeratorAPI(
  req: NextRequest,
  options?: AdminGuardOptions
): Promise<{ userId: string; role: 'admin' | 'moderator' }> {
  try {
    const { userId, role } = await ensureUserAllowed('moderator');

    if (!options?.allowSelfModify) {
      await checkSelfModify(req, userId);
    }

    return { userId, role };
  } catch (err) {
    if (err instanceof Response) throw err;
    throw new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
  }
}

/**
 * ✅ Блокируем попытки изменять самого себя через админку
 */
async function checkSelfModify(req: NextRequest, currentUserId: string): Promise<void> {
  try {
    const body = await req.clone().json().catch(() => ({} as Record<string, unknown>));

    const targetId =
      (body as any)?.id ??
      (body as any)?.userId ??
      (body as any)?.user_id ??
      (body as any)?.targetUserId ??
      (body as any)?.target_user_id;

    if (targetId && String(targetId) === currentUserId) {
      throw new Response(
        JSON.stringify({
          ok: false,
          error: 'self_modify_forbidden',
          message: 'Cannot modify your own account through admin panel',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (err) {
    if (err instanceof Response) throw err;
  }
}

/**
 * ✅ Удобные врапперы для Route Handlers
 */
export function withAdminAuth<T>(
  handler: (userId: string, role: 'admin') => Promise<T>,
  options?: AdminGuardOptions
) {
  return async (req: NextRequest): Promise<NextResponse | T> => {
    try {
      const { userId, role } = await requireAdminAPI(req, options);
      return await handler(userId, role);
    } catch (err) {
      if (err instanceof Response) {
        return NextResponse.json(await err.json(), { status: err.status });
      }
      return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 });
    }
  };
}

export function withModeratorAuth<T>(
  handler: (userId: string, role: 'admin' | 'moderator') => Promise<T>,
  options?: AdminGuardOptions
) {
  return async (req: NextRequest): Promise<NextResponse | T> => {
    try {
      const { userId, role } = await requireModeratorAPI(req, options);
      return await handler(userId, role);
    } catch (err) {
      if (err instanceof Response) {
        return NextResponse.json(await err.json(), { status: err.status });
      }
      return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 });
    }
  };
}