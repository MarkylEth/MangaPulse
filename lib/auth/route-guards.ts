// lib/auth/route-guards.ts
import type { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { getSessionToken, verifySession } from '@/lib/auth/session';

/* ====================== Types ====================== */
export type AuthUser = {
  id: string;
  username: string | null;
  email: string | null;
  role: "admin" | "moderator" | "user" | string | null;
  leaderTeamId: number | null;
};

export type GuardFailReason = "unauthorized" | "forbidden" | "no_session";
type GuardOk = { ok: true; status: 200; reason: null; user: AuthUser };
type GuardFail = { ok: false; status: 401 | 403; reason: GuardFailReason; user: AuthUser | null };

/* ====================== Config ====================== */
const ALLOW_DEV_HEADER_ID =
  String(process.env.AUTH_ALLOW_DEV_HEADER || "").trim() === "1" ||
  process.env.NODE_ENV !== "production";

/* ====================== Small helpers ====================== */
function isValidUUID(uuid: string): boolean {
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return re.test(uuid);
}

/** Единый конструктор JSON-ответов об ошибке для throw Response */
function jsonError(status: 401 | 403, reason: GuardFailReason) {
  return new Response(JSON.stringify({ error: reason }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** dev-фолбэк: берём id из заголовка/куки x-user-id (только в dev, если разрешено) */
async function getViewerIdFromHeaderOrCookie(req?: Request | NextRequest): Promise<string | null> {
  if (!ALLOW_DEV_HEADER_ID) return null;
  try {
    const idFromHeader = req?.headers?.get("x-user-id")?.trim();
    if (idFromHeader && isValidUUID(idFromHeader)) return idFromHeader;
  } catch {}
  try {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    const idFromCookie = store.get("x-user-id")?.value?.trim();
    if (idFromCookie && isValidUUID(idFromCookie)) return idFromCookie;
  } catch {}
  return null;
}

/* ====================== Core auth ====================== */
export async function getAuthUser(req?: Request | NextRequest): Promise<AuthUser | null> {
  let userId: string | null = null;
  try {
    const token = await getSessionToken();
    const payload = verifySession(token);
    if (payload?.sub) userId = String(payload.sub);
  } catch {}

  if (!userId) {
    const devId = await getViewerIdFromHeaderOrCookie(req);
    if (devId) userId = devId;
  }
  if (!userId) return null;

  const { rows } = await query<{
    id: string;
    email: string | null;
    username: string | null;
    role: string | null;
    leader_team_id: number | null;
  }>(
    `SELECT 
      u.id,
      u.email,
      u.username,
      COALESCE(p.role, 'user') as role,
      ttm.team_id as leader_team_id
    FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    LEFT JOIN translator_team_members ttm ON ttm.user_id = u.id AND (ttm.is_leader = true OR ttm.role = 'leader')
    WHERE u.id = $1
    LIMIT 1`,
    [userId]
  );

  if (!rows[0]) return null;

  return {
    id: rows[0].id,
    username: rows[0].username,
    email: rows[0].email,
    role: rows[0].role as any,
    leaderTeamId: rows[0].leader_team_id,
  };
}

/* ====================== Guards (OK/Fail объект) ====================== */
/** Обязательно авторизован — бросает 401 (удобно для страниц/действий). */
export async function requireUser(req?: Request | NextRequest): Promise<AuthUser> {
  const u = await getAuthUser(req);
  if (!u) throw new Response("Unauthorized", { status: 401 });
  return u;
}

/** ok/401 без исключений — если удобнее таким форматом. */
export async function requireLoggedIn(req?: Request | NextRequest): Promise<GuardOk | GuardFail> {
  const user = await getAuthUser(req);
  if (!user) return { ok: false, status: 401, reason: "unauthorized", user: null };
  return { ok: true, status: 200, reason: null, user };
}

/** ok/403 без исключений — «мягкий» вариант. */
export async function requireRole(
  req: Request | NextRequest,
  roles: string[] | string
): Promise<GuardOk | GuardFail> {
  const allowed = (Array.isArray(roles) ? roles : [roles]).map((r) => String(r).toLowerCase());
  const u = await getAuthUser(req);
  if (!u) return { ok: false, status: 401, reason: "unauthorized", user: null };

  const role = String(u.role ?? "user").toLowerCase();
  if (!allowed.includes(role)) return { ok: false, status: 403, reason: "forbidden", user: u };
  return { ok: true, status: 200, reason: null, user: u };
}

/* ====================== Guards (бросающие исключение) ====================== */
/** Бросающая версия: гарантирует авторизацию, иначе throw Response 401(JSON). */
export async function ensureLoggedIn(req?: Request | NextRequest): Promise<AuthUser> {
  const u = await getAuthUser(req);
  if (!u) throw jsonError(401, "unauthorized");
  return u;
}

/** Бросающая версия requireRole: 401 если не залогинен, 403 если роль не подходит. */
export async function ensureRole(
  req: Request | NextRequest,
  roles: string[] | string
): Promise<AuthUser> {
  const allowed = (Array.isArray(roles) ? roles : [roles]).map((r) => String(r).toLowerCase());
  const u = await getAuthUser(req);
  if (!u) throw jsonError(401, "unauthorized");

  const role = String(u.role ?? "user").toLowerCase();
  if (!allowed.includes(role)) throw jsonError(403, "forbidden");

  return u;
}

/** По API-ключу даём системный доступ, иначе требуем роль — «мягко». */
export async function requireUploader(req: Request | NextRequest): Promise<GuardOk | GuardFail> {
  const key = (req.headers as any)?.get?.("x-api-key")?.trim?.() ?? "";
  const allowKey =
    key &&
    (key === (process.env.ADMIN_UPLOAD_KEY || "") ||
      key === (process.env.NEXT_PUBLIC_ADMIN_UPLOAD_KEY || ""));

  if (allowKey) {
    return {
      ok: true,
      status: 200,
      reason: null,
      user: { id: "system", username: "system", email: null, role: "admin", leaderTeamId: null },
    };
  }
  return requireRole(req, ["admin", "moderator"]);
}

/** Бросающая версия uploader: кидает 401/403 JSON. */
export async function ensureUploader(req: Request | NextRequest): Promise<AuthUser> {
  const key = (req.headers as any)?.get?.("x-api-key")?.trim?.() ?? "";
  const allowKey =
    key &&
    (key === (process.env.ADMIN_UPLOAD_KEY || "") ||
      key === (process.env.NEXT_PUBLIC_ADMIN_UPLOAD_KEY || ""));
  if (allowKey) {
    return { id: "system", username: "system", email: null, role: "admin", leaderTeamId: null };
  }
  return ensureRole(req, ["admin", "moderator"]);
}

/* ====================== Back-compat ====================== */
export async function getViewerId(req?: Request | NextRequest): Promise<string | null> {
  const u = await getAuthUser(req);
  return u?.id ?? null;
}
export async function requireViewer(req?: Request | NextRequest): Promise<string> {
  const id = await getViewerId(req);
  if (!id) throw new Error("UNAUTHORIZED: User ID is required");
  return id;
}
export async function getAuthUserLegacy(req?: Request | NextRequest): Promise<{ id: string } | null> {
  const u = await getAuthUser(req);
  return u ? { id: u.id } : null;
}