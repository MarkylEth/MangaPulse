// lib/admin/rate-limit.ts
import type { NextRequest } from 'next/server';

/**
 * Rate Limiting для защиты от брутфорса и DDoS
 * 
 * In-memory хранилище. Для продакшена стоит заменить на Redis.
 */

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

// Настройки
const WINDOW_MS = 15 * 60 * 1000; // 15 минут
const MAX_REQUESTS = 100;         // максимум запросов на IP за окно

// In-memory хранилище (для продакшена лучше использовать Redis)
const requestCounts = new Map<string, RateLimitRecord>();

/**
 * Получение IP адреса клиента
 */
function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');          // "ip1, ip2, ip3"
  if (forwarded) return forwarded.split(',')[0].trim();

  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp;

  const cfConnectingIp = req.headers.get('cf-connecting-ip');    // Cloudflare
  if (cfConnectingIp) return cfConnectingIp;

  // Fallback: один общий ключ для неизвестных клиентов
  return 'unknown';
}

/**
 * Проверка rate limit для IP адреса
 * @returns true если запрос разрешен, false если превышен лимит
 */
export function checkRateLimit(req: NextRequest): boolean {
  const ip = getClientIp(req);
  const now = Date.now();

  const record = requestCounts.get(ip);

  // новое окно
  if (!record || now > record.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + WINDOW_MS });
    cleanupOldRecords(now);
    return true;
  }

  // лимит исчерпан
  if (record.count >= MAX_REQUESTS) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[RATE_LIMIT] Blocked IP: ${ip} (${record.count} requests)`);
    }
    return false;
  }

  // увеличиваем счетчик
  record.count++;
  return true;
}

/**
 * Информация о текущем лимите для IP (для заголовков)
 */
export function getRateLimitInfo(req: NextRequest): {
  limit: number;
  remaining: number;
  reset: number;
} {
  const ip = getClientIp(req);
  const now = Date.now();
  const record = requestCounts.get(ip);

  if (!record || now > record.resetTime) {
    return {
      limit: MAX_REQUESTS,
      remaining: MAX_REQUESTS - 1, // текущий запрос засчитываем
      reset: now + WINDOW_MS,
    };
  }

  return {
    limit: MAX_REQUESTS,
    remaining: Math.max(0, MAX_REQUESTS - record.count),
    reset: record.resetTime,
  };
}

/**
 * Очистка старых записей из памяти (примерно в 1% проверок)
 */
function cleanupOldRecords(now: number): void {
  if (Math.random() > 0.01) return;
  for (const [ip, record] of requestCounts.entries()) {
    if (now > record.resetTime) {
      requestCounts.delete(ip);
    }
  }
}

/** Сброс лимита для конкретного IP (удобно для тестов) */
export function resetRateLimit(ip: string): void {
  requestCounts.delete(ip);
}

/** Простая статистика (для мониторинга) */
export function getRateLimitStats(): { totalIPs: number; blockedIPs: number } {
  let blocked = 0;
  for (const record of requestCounts.values()) {
    if (record.count >= MAX_REQUESTS) blocked++;
  }
  return { totalIPs: requestCounts.size, blockedIPs: blocked };
}
