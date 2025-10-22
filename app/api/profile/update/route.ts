// app/api/profile/update/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { query } from '@/lib/db';
import { assertOriginJSON } from '@/lib/csrf';

export async function POST(req: NextRequest) {
  try {
    assertOriginJSON(req);
    
    const user = await requireAuth();
    const body = await req.json();
    
    // ✅ КРИТИЧЕСКИ ВАЖНО: Фильтруем по user.id из сессии
    await query(
      `UPDATE profiles SET
        display_name = $2,
        avatar_url = $3,
        banner_url = $4,
        bio = $5
       WHERE user_id = $1`, // ✅ НЕ из body!
      [user.id, body.display_name, body.avatar_url, body.banner_url, body.bio]
    );
    
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}