//lib\csrf.ts
import { NextRequest, NextResponse } from "next/server";

function collectAllowed(req: NextRequest): Set<string> {
  const env = (process.env.SITE_ORIGINS || process.env.SITE_ORIGIN || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  const set = new Set<string>([
    "http://localhost:3000",
    "http://172.16.0.2:3000",
  ]);

  const proto = req.headers.get("x-forwarded-proto") || "http";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (host) set.add(`${proto}://${host}`);
  if (req.nextUrl?.origin) set.add(req.nextUrl.origin);

  env.forEach(o => set.add(o));
  return set;
}

export function assertOriginJSON(req: NextRequest): void {
  const origin = req.headers.get("origin") ?? "";
  const referer = req.headers.get("referer") ?? "";
  const ALLOWED = collectAllowed(req);

  const ok =
    [...ALLOWED].some(a => origin.startsWith(a) || referer.startsWith(a)) ||
    (!origin && !referer);

  if (!ok) {
    throw NextResponse.json(
      { ok: false, error: "invalid_origin", origin, referer, allowed: [...ALLOWED] },
      { status: 403 }
    );
  }
}
