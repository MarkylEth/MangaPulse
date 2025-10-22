// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { SESSION_COOKIE } from '@/lib/auth/config';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-min-32-chars-long!!'
);

const isDev = process.env.NODE_ENV === 'development';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Защита админ-роутов
  if (pathname.startsWith('/admin')) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    
    // ✅ Логи только в dev режиме
    if (isDev) {
      console.log('[MIDDLEWARE] Checking access for:', pathname);
      console.log('[MIDDLEWARE] Token present:', !!token);
    }
    
    if (!token) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    try {
      // Проверяем JWT
      const { payload } = await jwtVerify(token, JWT_SECRET);
      
      if (!payload?.sub) {
        return NextResponse.redirect(new URL('/auth/login', request.url));
      }

      // Проверка роли и banned status из БД
      const { neon } = await import('@neondatabase/serverless');
      const sql = neon(process.env.DATABASE_URL!);
      
      const result = await sql`
        SELECT role, banned 
        FROM profiles 
        WHERE user_id = ${payload.sub}::uuid
        LIMIT 1
      `;

      const user = result[0];
      
      if (!user) {
        if (isDev) console.log('[MIDDLEWARE] User not found in DB');
        return NextResponse.redirect(new URL('/', request.url));
      }

      // ✅ Проверка на бан
      if (user.banned) {
        if (isDev) console.log('[MIDDLEWARE] User is banned');
        return NextResponse.redirect(new URL('/auth/login?error=banned', request.url));
      }

      // ✅ Проверка роли
      if (user.role !== 'admin' && user.role !== 'moderator') {
        if (isDev) console.log('[MIDDLEWARE] Access denied - role:', user.role);
        return NextResponse.redirect(new URL('/', request.url));
      }

      if (isDev) {
        console.log('[MIDDLEWARE] ✅ Access granted for', payload.sub, 'with role', user.role);
      }

      // ✅ Security headers
      const response = NextResponse.next();
      
      response.headers.set('X-Frame-Options', 'DENY');
      response.headers.set('X-Content-Type-Options', 'nosniff');
      response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
      
      // ✅ CSP для админки
      response.headers.set(
        'Content-Security-Policy',
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https:; " +
        "font-src 'self' data:; " +
        "connect-src 'self';"
      );
      
      return response;

    } catch (error) {
      // ✅ Логируем только критические ошибки
      console.error('[MIDDLEWARE] Auth error:', error instanceof Error ? error.message : 'Unknown error');
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*']
};