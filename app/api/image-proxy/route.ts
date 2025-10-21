// app/api/image-proxy/route.ts
import { NextRequest } from "next/server";
import dns from "node:dns/promises";
import net from "node:net";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ====== настройки ====== */
const TIMEOUT_MS = 10_000;               // таймаут до апстрима
const MAX_BYTES  = 10 * 1024 * 1024;     // максимум 10 МБ
const ALLOWED_PORTS = new Set([80, 443]);

// домены, которые можно проксировать (с учётом твоего next.config.mjs)
const ALLOWED_HOSTS: string[] = [
  // wasabi
  "wasabisys.com",
  "s3.wasabisys.com",

  // твои текущие
  "image.winudf.com",
  "winudf.com",
  "xlm.ru",
  "cdn.discordapp.com",

  // shikimori
  "shikimori.one",
  "shikimori.me",
  "static.shikimori.one",
  "desu.shikimori.one",
];

// простой rate-limit (in-memory sliding window)
const rlWindowMs = 10_000;
const rlMax = 30;
const rlStore = new Map<string, number[]>();

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const arr = rlStore.get(ip) || [];
  const fresh = arr.filter((t) => now - t < rlWindowMs);
  fresh.push(now);
  rlStore.set(ip, fresh);
  return fresh.length <= rlMax;
}

function clientIp(req: NextRequest): string {
  const xfwd = req.headers.get("x-forwarded-for");
  if (xfwd) return xfwd.split(",")[0].trim();
  const xr = req.headers.get("x-real-ip");
  if (xr) return xr.trim();
  return "local";
}

function isHttpUrl(u: URL) {
  return u.protocol === "http:" || u.protocol === "https:";
}

function isAllowedHost(hostname: string) {
  const h = hostname.toLowerCase();
  return ALLOWED_HOSTS.some((allowed) => {
    const a = allowed.toLowerCase();
    if (h === a) return true;
    return h.endsWith("." + a);
  });
}

function isPrivateIPv4(ip: string) {
  const parts = ip.split(".").map((x) => Number(x));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  // частные/служебные/опасные диапазоны
  if (a === 10) return true;                         // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16.0.0/12
  if (a === 192 && b === 168) return true;           // 192.168.0.0/16
  if (a === 127) return true;                        // 127.0.0.0/8 loopback
  if (a === 0) return true;                          // 0.0.0.0/8
  if (a === 169 && b === 254) return true;           // 169.254.0.0/16 link-local
  if (a >= 224 && a <= 239) return true;             // 224.0.0.0/4 multicast
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  return false;
}

function isPrivateIPv6(ip: string) {
  const s = ip.toLowerCase();
  return (
    s === "::1" ||                       // loopback
    s.startsWith("fc") || s.startsWith("fd") || // fc00::/7 ULA
    s.startsWith("fe8") || s.startsWith("fe9") || s.startsWith("fea") || s.startsWith("feb") || // fe80::/10 link-local
    s.startsWith("ff") ||                // ff00::/8 multicast
    s === "::" ||                        // unspecified
    s.startsWith("::ffff:")              // IPv4-mapped
  );
}

async function assertHostSafe(u: URL) {
  if (!isHttpUrl(u)) throw new Error("bad_protocol");
  const port = Number(u.port || (u.protocol === "https:" ? 443 : 80));
  if (!ALLOWED_PORTS.has(port)) throw new Error("bad_port");
  if (!isAllowedHost(u.hostname)) throw new Error("host_not_allowed");

  // SSRF guard: отрезолвим DNS и проверим IP
  // (lookup — не следует CNAME; получаем конечный A/AAAA)
  const result = await dns.lookup(u.hostname, { all: true });
  if (!result.length) throw new Error("dns_failed");

  for (const rec of result) {
    const ip = rec.address;
    const ver = net.isIP(ip);
    if (ver === 4 && isPrivateIPv4(ip)) throw new Error("private_ip");
    if (ver === 6 && isPrivateIPv6(ip)) throw new Error("private_ip6");
  }
}

function timeoutSignal(ms: number) {
  const ac = new AbortController();
  const id = setTimeout(() => ac.abort(), ms);
  return { signal: ac.signal, cancel: () => clearTimeout(id) };
}

export async function GET(req: NextRequest) {
  try {
    const ip = clientIp(req);
    if (!rateLimit(ip)) {
      return new Response("rate_limited", { status: 429 });
    }

    const url = new URL(req.url);
    const u = url.searchParams.get("u");
    if (!u) return new Response("missing u", { status: 400 });

    let target: URL;
    try {
      target = new URL(u);
    } catch {
      return new Response("bad url", { status: 400 });
    }

    await assertHostSafe(target);

    const { signal, cancel } = timeoutSignal(TIMEOUT_MS);
    const upstream = await fetch(target.toString(), {
      method: "GET",
      headers: {
        // «обычный» UA, без реферера/кук
        "user-agent": "Mozilla/5.0",
        "referer": "",
      },
      redirect: "follow",
      cache: "no-store",
      signal,
    }).finally(cancel);

    if (!upstream.ok || !upstream.body) {
      return new Response(`upstream ${upstream.status}`, { status: 502 });
    }

    // Проверим content-length (если есть)
    const cl = upstream.headers.get("content-length");
    if (cl && Number(cl) > MAX_BYTES) {
      return new Response("too_large", { status: 413 });
    }

    // Стримим с жёстким лимитом по байтам
    let transferred = 0;
    const reader = upstream.body.getReader();
    const limitedStream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        transferred += value.byteLength;
        if (transferred > MAX_BYTES) {
          controller.error(new Error("limit"));
          return;
        }
        controller.enqueue(value);
      },
      cancel(reason) {
        try { reader.cancel(reason); } catch {}
      },
    });

    // Только безопасные заголовки наружу
    const type = upstream.headers.get("content-type") ?? "image/jpeg";
    const etag = upstream.headers.get("etag") ?? undefined;
    const lastMod = upstream.headers.get("last-modified") ?? undefined;

    const headers = new Headers();
    headers.set("content-type", type);
    headers.set("cache-control", "public, max-age=86400, s-maxage=86400, stale-while-revalidate=600");
    if (etag) headers.set("etag", etag);
    if (lastMod) headers.set("last-modified", lastMod);
    headers.set("content-disposition", "inline");
    headers.set("x-proxy-from", new URL(target).hostname);
    headers.set("cross-origin-resource-policy", "same-origin");
    headers.set("x-content-type-options", "nosniff");

    return new Response(limitedStream, { status: 200, headers });
  } catch (e: any) {
    const msg = String(e?.message || e);
    // Нормализуем ошибки в коды
    if (msg === "host_not_allowed") return new Response("forbidden_host", { status: 403 });
    if (msg === "bad_protocol")     return new Response("bad_protocol", { status: 400 });
    if (msg === "bad_port")         return new Response("bad_port", { status: 400 });
    if (msg === "dns_failed")       return new Response("dns_failed", { status: 502 });
    if (msg === "private_ip" || msg === "private_ip6") return new Response("forbidden_ip", { status: 403 });
    if (msg === "limit")            return new Response("too_large", { status: 413 });
    if (msg === "The operation was aborted") return new Response("upstream_timeout", { status: 504 });
    return new Response("proxy_error", { status: 502 });
  }
}
