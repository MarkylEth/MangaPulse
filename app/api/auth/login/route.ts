// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { signSession, setSessionCookie } from "@/lib/auth/session";
import { assertOriginJSON } from "@/lib/csrf";
import { LoginSchema } from "@/lib/validate";
import { makeKey, registerFail, resetCounter } from "@/lib/anti-bruteforce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: unknown, init?: number | ResponseInit) {
  const res =
    typeof init === "number"
      ? NextResponse.json(data, { status: init })
      : NextResponse.json(data, init);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

function getClientIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    (req as any).ip ||
    "local"
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(req: NextRequest) {
  try {
    // 1) CSRF / Origin → всегда JSON при запрете
    assertOriginJSON(req);

    // 2) Валидация тела
    const body = await req.json().catch(() => ({}));
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return json({ ok: false, error: parsed.error.flatten() }, 400);
    }
    const { email, password } = parsed.data;
    const emailLower = email.toLowerCase();

    // 3) Анти-брутфорс по IP+email
    const ip = getClientIp(req);
    const key = makeKey(ip, emailLower);

    // 4) ✅ ИСПРАВЛЕНО: Поиск пользователя с JOIN profiles
    const r = await query<{
      id: string;
      email: string | null;
      username: string | null;
      password_hash: string | null;
      display_name: string | null;
      avatar_url: string | null;
      role: 'admin' | 'moderator' | 'user';
    }>(
      `SELECT 
        u.id, 
        u.email, 
        u.username,
        u.password_hash,
        p.display_name,
        p.avatar_url,
        COALESCE(p.role, 'user') as role
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.email = $1
       LIMIT 1`,
      [emailLower]
    );
    const u = r.rows[0];

    // 5) Неверный email/нет пароля → откладываем и даём 401
    if (!u?.password_hash) {
      await sleep(registerFail(key));
      return json({ ok: false, error: "invalid_credentials" }, 401);
    }

    // 6) Проверка пароля
    const ok = await verifyPassword(password, u.password_hash);
    if (!ok) {
      await sleep(registerFail(key));
      return json({ ok: false, error: "invalid_credentials" }, 401);
    }

    // 7) Успех → сброс счётчика
    resetCounter(key);

    // 8) ✅ Подписываем mp_session с ролью
    const token = signSession({ 
      sub: u.id, 
      role: u.role 
    });

    const res = json({
      ok: true,
      user: {
        id: u.id,
        email: u.email,
        username: u.username,
        display_name: u.display_name,
        avatar_url: u.avatar_url,
        role: u.role,
      },
    });

    setSessionCookie(res, token, req);

    return res;
  } catch (e: any) {
    // assertOriginJSON бросает готовый JSON-Response → просто вернём его
    if (e instanceof Response) return e;

    console.error("[POST /api/auth/login] fatal:", e);
    return json(
      { ok: false, error: "internal", message: e?.message ?? "internal" },
      500
    );
  }
}