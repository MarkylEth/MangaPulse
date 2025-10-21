// app/api/auth/me/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { verifySession } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/config"; // ← ПРАВИЛЬНЫЙ ИМПОРТ

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1) читаем токен сессии из куки
    const token = (await cookies()).get(SESSION_COOKIE)?.value ?? null;
    const payload = verifySession(token); // verifySession синхронный — без await

    if (!payload?.sub) {
      return NextResponse.json(
        { ok: true, user: null, profile: null },
        { headers: { "Cache-Control": "no-store", "Vary": "Cookie" } }
      );
    }

    const uid = String(payload.sub);

    // 2) user из users
    const userRes = await query<{
      id: string;
      email: string | null;
      name: string | null;
      created_at: string | null;
    }>(
      `SELECT id::text AS id, email, name, created_at
         FROM public.users
        WHERE id = $1
        LIMIT 1`,
      [uid]
    );

    const user = userRes.rows?.[0]
      ? {
          id: String(userRes.rows[0].id),
          email: userRes.rows[0].email ?? null,
          name: userRes.rows[0].name ?? null,
          created_at: userRes.rows[0].created_at ?? null,
        }
      : { id: uid, email: null, name: null, created_at: null };

    // 3) profile из profiles (приводим к схеме: PK=id, без user_id)
    const profRes = await query<{
      id: string;
      username: string | null;
      nickname: string | null;
      display_name: string | null;
      avatar_url: string | null;
      role: string | null;
      email: string | null;
    }>(
      `
      SELECT id::text,
             username,
             nickname,
             display_name,
             avatar_url,
             role,
             email
        FROM public.profiles
       WHERE id = $1
       LIMIT 1
      `,
      [uid]
    );
    const profile = profRes.rows?.[0] ?? null;

    // 4) Дублируем role из профиля в user для удобства фронта
    const role = profile?.role ?? null;
    const userWithRole = { ...user, role };

    return NextResponse.json(
      { ok: true, user: userWithRole, profile },
      { headers: { "Cache-Control": "no-store", "Vary": "Cookie" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: true, user: null, profile: null, error: e?.message ?? "internal_error" },
      { status: 200, headers: { "Cache-Control": "no-store", "Vary": "Cookie" } }
    );
  }
}