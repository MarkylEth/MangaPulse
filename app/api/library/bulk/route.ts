// app/api/library/bulk/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
// Вариант А (унифицировано с другими роутами):
// import { getAuthUser } from '@/lib/auth/route-guards';
// Вариант Б (как у тебя сейчас, если внутри читаются cookies()):
import { getSessionUser } from '@/lib/auth/session'
export const dynamic = 'force-dynamic';

type ReadStatus = 'planned' | 'reading' | 'completed' | 'dropped';
type Item = {
  manga_id: number;
  favorite?: boolean | null;
  status?: ReadStatus | null | string; // может прилететь "  reading  "
  updated_at?: number;
};

const ALLOWED_STATUS = new Set<ReadStatus>(['planned', 'reading', 'completed', 'dropped']);
const MAX_INPUT = 500;

function ok(payload: any, init?: number) {
  return NextResponse.json({ ok: true, ...payload }, { status: init ?? 200 });
}
function err(message: string, status = 400, extra?: any) {
  return NextResponse.json({ ok: false, error: message, ...(extra ?? {}) }, { status });
}

function normStatus(s: unknown): ReadStatus | null | undefined {
  if (s === undefined) return undefined;       // «не менять»
  if (s === null) return null;                 // «очистить»
  const t = String(s).trim().toLowerCase();
  if (!t) return null;                         // пустая строка → null
  return ALLOWED_STATUS.has(t as ReadStatus) ? (t as ReadStatus) : undefined; // invalid → undefined (пропустим)
}

export async function POST(req: NextRequest) {
  try {
    // Вариант А: const me = await getAuthUser(req);
    const me = await getSessionUser();
    const userId = me?.id ?? null;
    if (!userId) return err('auth', 401);

    const body = await req.json().catch(() => ({}));
    const rawItems: Item[] = Array.isArray(body?.items) ? body.items : [];
    if (rawItems.length === 0) return ok({ skipped: true });

    // дедуп по manga_id: берём ПОСЛЕДНИЙ элемент (ближе к «самому свежему» клику)
    const byId = new Map<number, Item>();
    for (const raw of rawItems.slice(0, MAX_INPUT)) {
      const id = Number(raw?.manga_id);
      if (!Number.isFinite(id) || id <= 0) continue;

      const favorite =
        typeof raw.favorite === 'boolean' ? raw.favorite :
        raw.favorite === null ? null : null; // null = «не менять» для UPDATE, false по умолчанию для INSERT (см. SQL)

      const status = normStatus(raw.status);
      // Если статус пришёл, но невалидный → просто не трогаем статус для этого итема.
      // Если хочешь жёстко валидировать — верни err('invalid_status').

      byId.set(id, { manga_id: id, favorite, status, updated_at: raw.updated_at });
    }

    const items = Array.from(byId.values());
    if (items.length === 0) return ok({ skipped: true });

    // build VALUES
    const values: any[] = [];
    const rowsSql = items
      .map((it) => {
        values.push(userId, it.manga_id, it.favorite, it.status);
        const i = values.length;
        // user_id::uuid, manga_id::int, is_favorite::boolean, status::read_status
        return `($${i - 3}::uuid, $${i - 2}::int, $${i - 1}::boolean, $${i}::read_status)`;
      })
      .join(',');

    // Одним стейтментом: UPDATE существующих, затем INSERT отсутствующих.
    const sql = `
      WITH data (user_id, manga_id, is_favorite, status) AS (
        VALUES ${rowsSql}
      ),
      upd AS (
        UPDATE user_library ul
           SET is_favorite = COALESCE(d.is_favorite, ul.is_favorite),
               status      = COALESCE(d.status,      ul.status),
               updated_at  = NOW()
          FROM data d
         WHERE ul.user_id = d.user_id
           AND ul.manga_id = d.manga_id
        RETURNING ul.user_id, ul.manga_id
      )
      INSERT INTO user_library (user_id, manga_id, is_favorite, status, updated_at)
      SELECT
        d.user_id,
        d.manga_id,
        COALESCE(d.is_favorite, FALSE),
        /* если не хочешь дефолт 'planned' — поставь здесь NULL */
        COALESCE(d.status, 'planned'::read_status),
        NOW()
      FROM data d
      LEFT JOIN upd u
        ON u.user_id = d.user_id AND u.manga_id = d.manga_id
      LEFT JOIN user_library ul
        ON ul.user_id = d.user_id AND ul.manga_id = d.manga_id
      WHERE u.user_id IS NULL AND ul.user_id IS NULL;
    `;

    await query(sql, values);
    return ok({ count: items.length });
  } catch (e: any) {
    console.error('bulk route failed:', e?.message || e);
    return err('bulk_failed', 500, { detail: String(e?.message || e) });
  }
}

