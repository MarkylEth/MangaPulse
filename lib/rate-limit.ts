// lib/rate-limit.ts
const hits = new Map<string, { c: number; t: number }>();

export function rateLimit(key: string, limit = 5, windowMs = 60_000) {
  const now = Date.now();
  const rec = hits.get(key);
  if (!rec || now - rec.t > windowMs) {
    hits.set(key, { c: 1, t: now });
    return true;
  }
  if (rec.c >= limit) return false;
  rec.c++;
  return true;
}
