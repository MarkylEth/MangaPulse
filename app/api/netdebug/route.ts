if (process.env.NODE_ENV === "production") {
  export const GET    = () => new Response("Not available", { status: 404 });
  export const POST   = GET; export const PUT = GET; export const DELETE = GET; export const PATCH = GET;
}
// app/api/netdebug/route.ts
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const headers: Record<string, string> = {};
  for (const [k, v] of (req as any).headers || []) headers[k] = v;

  const info = {
    method: 'GET',
    href: url.href,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams.entries()),
    headers,
    // на Vercel: request ip через хедеры, в dev — нет
    ip: headers['x-forwarded-for']?.split(',')[0]?.trim() ?? null,
    ts: new Date().toISOString(),
  };
  return NextResponse.json({ ok: true, info });
}

