// middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/config';

const isDev = process.env.NODE_ENV === 'development';

/**
 * ЛЁГКАЯ проверка для /admin:
 * - наличие cookie сессии
 * Security headers
 * Полная проверка JWT + роли + бана — в layout.tsx и API guards
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Защищаем только /admin
  if (pathname.startsWith('/admin')) {
    // 1) Rate limit УБРАН - он вероятно использует crypto
    
    // 2) Проверяем наличие cookie (без расшифровки JWT)
    const token = request.cookies.get(SESSION_COOKIE)?.value;

    if (isDev) {
      console.log('[MIDDLEWARE] /admin hit:', pathname);
      console.log('[MIDDLEWARE] token present:', Boolean(token));
    }

    // 3) Если нет токена — 404 (скрываем существование админки)
    if (!token) {
      return NextResponse.rewrite(new URL('/404', request.url));
    }

    // 4) Готовим ответ + хедеры
    const res = NextResponse.next();

    // Security headers
    res.headers.set('X-Frame-Options', 'DENY');
    res.headers.set('X-Content-Type-Options', 'nosniff');
    res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.headers.set('X-XSS-Protection', '1; mode=block');

    if (process.env.NODE_ENV === 'production') {
      res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    // CSP только для админки
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');
    res.headers.set('Content-Security-Policy', csp);

    if (isDev) {
      console.log('[MIDDLEWARE] ✅ allow /admin (full check in layout)');
    }
    return res;
  }

  // Базовые заголовки для остальных роутов
  const res = NextResponse.next();
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'SAMEORIGIN');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return res;
}

export const config = {
  matcher: ['/admin/:path*'],
};