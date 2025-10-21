// lib/auth/config.ts
export const SESSION_COOKIE = "mp_session" as const;

function coalesceEnv(...keys: string[]) {
  for (const k of keys) { const v = process.env[k]; if (v) return v; }
  return undefined;
}

// 1) основной секрет для mp_session
export const SESSION_JWT_SECRET =
  coalesceEnv("JWT_SECRET", "NEXTAUTH_SECRET") ??
  (() => { throw new Error("Missing SESSION_JWT_SECRET (set JWT_SECRET or NEXTAUTH_SECRET)"); })();

// 2) отдельный секрет для email/reset токенов (можно = SESSION_JWT_SECRET)
export const MAGIC_JWT_SECRET = process.env.AUTH_JWT_SECRET ?? SESSION_JWT_SECRET;

// 3) единая логика secure (работает и за прокси)
export function shouldUseSecure(req?: Request) {
  const fwd = (req as any)?.headers?.get?.("x-forwarded-proto");
  if (fwd === "https") return true;
  const site =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.APP_URL ||
    process.env.SITE_URL || "";
  return site.startsWith("https://");
}
