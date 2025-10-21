// lib/auth/route-guards.ts
import type { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { readSessionTokenFromCookies, verifySession } from "@/lib/auth/session";

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

/* ====================== Helpers ====================== */
function isValidUUID(uuid: string): boolean {
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return re.test(uuid);
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
/** Достаём текущего пользователя из mp_session (+dev-фолбэк). */
export async function getAuthUser(req?: Request | NextRequest): Promise<AuthUser | null> {
  // 1) mp_session
  let userId: string | null = null;
  try {
    const token = await readSessionTokenFromCookies();
    const payload = verifySession(token);
    if (payload?.sub) userId = String(payload.sub);
  } catch {}

  // 2) dev-фолбэк
  if (!userId) {
    const devId = await getViewerIdFromHeaderOrCookie(req);
    if (devId) userId = devId;
  }

  if (!userId) return null;

  // profile: username/role
  let usernameFromProfile: string | null = null;
  let roleFromProfile: string | null = null;
  try {
    const prof = await query<{ username: string | null; role: string | null }>(
      `select username, coalesce(role,'user') as role
         from public.profiles
        where id = $1
        limit 1`,
      [userId]
    );
    usernameFromProfile = prof.rows?.[0]?.username ?? null;
    roleFromProfile = prof.rows?.[0]?.role ?? null;
  } catch {}

  // email из users
  let email: string | null = null;
  try {
    const u = await query<{ email: string | null }>(
      `select email from public.users where id = $1 limit 1`,
      [userId]
    );
    email = u.rows?.[0]?.email ?? null;
  } catch {}

  // лидерка (если есть)
  let leaderTeamId: number | null = null;
  try {
    const t = await query<{ team_id: number }>(
      `select team_id
         from translator_team_members
        where user_id::text = $1 and (is_leader is true or role = 'leader')
        limit 1`,
      [userId]
    );
    if (t.rows?.[0]?.team_id != null) leaderTeamId = Number(t.rows[0].team_id);
  } catch {}

  return {
    id: userId,
    username: usernameFromProfile,
    email,
    role: (roleFromProfile ?? "user") as any,
    leaderTeamId,
  };
}

/* ====================== Guards ====================== */
/** Удобный guard: обязательно авторизован (без аргументов). */
export async function requireUser(req?: Request | NextRequest): Promise<AuthUser> {
  const u = await getAuthUser(req);
  if (!u) throw new Response("Unauthorized", { status: 401 });
  return u;
}

/** Возвращает ok/401 без исключений — если удобнее таким форматом. */
export async function requireLoggedIn(req?: Request | NextRequest): Promise<GuardOk | GuardFail> {
  const user = await getAuthUser(req);
  if (!user) return { ok: false, status: 401, reason: "unauthorized", user: null };
  return { ok: true, status: 200, reason: null, user };
}

/** Требует роль из списка (user пропускается только если в списке). */
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

/** По API-ключу (x-api-key) даём доступ как системному администратору, иначе требуем роль. */
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
