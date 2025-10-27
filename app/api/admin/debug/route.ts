// app/api/admin/debug/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { SESSION_COOKIE, SESSION_JWT_SECRET } from '@/lib/auth/config';

export const dynamic = 'force-dynamic';

const JWT_SECRET = new TextEncoder().encode(SESSION_JWT_SECRET);

export async function GET() {
  try {
    const jar = await cookies();
    // ✅ ИСПРАВЛЕНО: используем SESSION_COOKIE
    const token = jar.get(SESSION_COOKIE)?.value;

    console.log('[DEBUG] Cookie name:', SESSION_COOKIE);
    console.log('[DEBUG] Token present:', !!token);
    console.log('[DEBUG] All cookies:', jar.getAll().map(c => c.name));

    if (!token) {
      return NextResponse.json({ 
        error: 'No session cookie found',
        expected_cookie: SESSION_COOKIE,
        found_cookies: jar.getAll().map(c => c.name)
      }, { status: 401 });
    }

    // Проверяем JWT
    const { payload } = await jwtVerify(token, JWT_SECRET);
    
    console.log('[DEBUG] JWT payload:', payload);
    
    if (!payload?.sub) {
      return NextResponse.json({ 
        error: 'Invalid token - no user ID',
        payload 
      }, { status: 401 });
    }

    // Проверка роли
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL!);
    
    const result = await sql`
      SELECT 
        user_id,
        display_name,
        role,
        created_at
      FROM profiles 
      WHERE user_id = ${payload.sub}::uuid
      LIMIT 1
    `;

    const user = result[0];

    console.log('[DEBUG] User from DB:', user);

    return NextResponse.json({
      success: true,
      cookie_name: SESSION_COOKIE,
      token_payload: {
        sub: payload.sub,
        exp: payload.exp,
        iat: payload.iat
      },
      user_from_db: user || null,
      has_admin_access: user?.role === 'admin',
      has_moderator_access: user?.role === 'admin' || user?.role === 'moderator',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[DEBUG] Error:', error);
    return NextResponse.json({
      error: String(error),
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}