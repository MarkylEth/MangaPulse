// lib/auth/session.ts
import jwt from "jsonwebtoken";
import type { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  SESSION_COOKIE,
  SESSION_JWT_SECRET,
  shouldUseSecure,
} from "@/lib/auth/config";

export type SessionPayload = {
  sub: string;                                // app_user_id
  role?: "admin" | "moderator" | "user";
};

const MAX_AGE = 60 * 60 * 24 * 30;

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, SESSION_JWT_SECRET, { expiresIn: MAX_AGE });
}

export function verifySession<T extends SessionPayload = SessionPayload>(token?: string | null): T | null {
  if (!token) return null;
  try {
    return jwt.verify(token, SESSION_JWT_SECRET) as T;
  } catch {
    return null;
  }
}

export function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecure(),
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecure(),
    path: "/",
    maxAge: 0,
  });
}

// === Удобства ===
export function createSession(res: NextResponse, token: string) {
  setSessionCookie(res, token);
}
export function destroySession(res: NextResponse) {
  clearSessionCookie(res);
}

/** Универсально получаем cookie store (работает и в Next 14, и в Next 15) */
async function getCookieStore(): Promise<Readonly<{
  get(name: string): { name: string; value: string } | undefined;
}>> {
  const jar: any = cookies();               // в Next 15 это Promise
  if (typeof jar?.then === "function") {
    return await jar;                       // Next 15
  }
  return jar;                               // Next 13/14
}

/** Прямое чтение токена из куки */
export async function readSessionTokenFromCookies(): Promise<string | null> {
  const jar = await getCookieStore();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

/* ========================================
   ✅ НОВАЯ ФУНКЦИЯ ДЛЯ API ROUTES
   ======================================== */

/**
 * Получает сессию из cookies и возвращает расшифрованные данные
 * Используй в API routes для проверки авторизации
 */
export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const token = await readSessionTokenFromCookies();
  if (!token) return null;
  
  return verifySession(token);
}

/**
 * Возвращает userId из сессии (алиас для sub)
 * Удобная обёртка для использования в API
 */
export async function getUserIdFromSession(): Promise<string | null> {
  const session = await getSessionFromCookies();
  return session?.sub ?? null;
}