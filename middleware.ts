// middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(_req: NextRequest) {
  // Если нужно — твоя логика для обычных страниц.
  return NextResponse.next();
}

/**
 * ⚠️ Самое важное — matcher:
 * запускать middleware ТОЛЬКО для "обычных" страниц приложения,
 * исключая всю статику/служебные пути Next и API.
 */
export const config = {
  matcher: [
    // Любые URL, КРОМЕ перечисленных:
    '/((?!_next/static|_next/image|_next/data|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|icons|assets|images|api).*)',
  ],
};
