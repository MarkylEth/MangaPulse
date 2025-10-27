// app/api/auth/me/route.ts
import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
export const dynamic = 'force-dynamic';

/**
 * ✅ Единственная ответственность: вернуть текущего пользователя
 * Не дублируем логику, используем getSessionUser()
 */
export async function GET() {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json(
        { ok: true, user: null },
        { 
          headers: { 
            'Cache-Control': 'no-store',
            'Vary': 'Cookie' 
          } 
        }
      );
    }

    // ✅ Единый формат ответа
    return NextResponse.json(
      {
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          role: user.role,
        },
      },
      { 
        headers: { 
          'Cache-Control': 'no-store',
          'Vary': 'Cookie' 
        } 
      }
    );
  } catch (error: any) {
    console.error('[GET /api/auth/me]', error);
    return NextResponse.json(
      { ok: false, error: 'internal_error' },
      { status: 500 }
    );
  }
}
