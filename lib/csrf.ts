// lib/csrf.ts
/**
 * ✅ CSRF защита для JSON API
 * Проверяет, что Origin совпадает с Host
 */

import type { NextRequest } from 'next/server';

/**
 * Проверяет Origin header для защиты от CSRF
 * Бросает Response с 403 если проверка не прошла
 */
export function assertOriginJSON(req: Request | NextRequest) {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  
  // В production требуем точное совпадение
  if (process.env.NODE_ENV === 'production') {
    const allowedOrigins = [
      `https://${host}`,
      process.env.NEXT_PUBLIC_SITE_URL,
      process.env.APP_URL,
      process.env.SITE_URL,
    ].filter(Boolean);
    
    if (!origin || !allowedOrigins.includes(origin)) {
      throw new Response(
        JSON.stringify({ 
          ok: false, 
          error: 'csrf_violation',
          message: 'Request origin does not match expected origin'
        }),
        { 
          status: 403, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
  }
  
  // В dev режиме разрешаем localhost
  if (process.env.NODE_ENV === 'development') {
    if (!origin) {
      // Некоторые инструменты (curl, Postman) не отправляют Origin
      // В dev режиме разрешаем это
      return;
    }
    
    const isLocalhost = 
      origin.includes('localhost') || 
      origin.includes('127.0.0.1') ||
      origin.includes(host || '');
    
    if (!isLocalhost) {
      throw new Response(
        JSON.stringify({ 
          ok: false, 
          error: 'csrf_violation',
          message: 'Request origin does not match expected origin'
        }),
        { 
          status: 403, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
  }
}

/**
 * Альтернативный вариант: просто проверяет и возвращает boolean
 */
export function checkOrigin(req: Request | NextRequest): boolean {
  try {
    assertOriginJSON(req);
    return true;
  } catch {
    return false;
  }
}