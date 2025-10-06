// app/api/auth/google/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { signSession, setSessionCookieOn } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Простая транслитерация ru -> en для full_name */
function translitRuToEn(s?: string | null): string | null {
  if (!s) return null;
  const map: Record<string, string> = {
    а:'a', б:'b', в:'v', г:'g', д:'d', е:'e', ё:'yo', ж:'zh', з:'z',
    и:'i', й:'y', к:'k', л:'l', м:'m', н:'n', о:'o', п:'p', р:'r', с:'s',
    т:'t', у:'u', ф:'f', х:'kh', ц:'ts', ч:'ch', ш:'sh', щ:'shch', ъ:'',
    ы:'y', ь:'', э:'e', ю:'yu', я:'ya',
    А:'A', Б:'B', В:'V', Г:'G', Д:'D', Е:'E', Ё:'Yo', Ж:'Zh', З:'Z',
    И:'I', Й:'Y', К:'K', Л:'L', М:'M', Н:'N', О:'O', П:'P', Р:'R', С:'S',
    Т:'T', У:'U', Ф:'F', Х:'Kh', Ц:'Ts', Ч:'Ch', Ш:'Sh', Щ:'Shch', Ъ:'',
    Ы:'Y', Ь:'', Э:'E', Ю:'Yu', Я:'Ya',
  };
  let out = '';
  for (const ch of s) out += map[ch] ?? ch;
  out = out.replace(/\s+/g, ' ').trim();
  return out.slice(0, 60);
}

function redir(origin: string, code: string, detail?: string) {
  const u = new URL('/', origin);
  u.searchParams.set('auth_error', code);
  if (detail) u.searchParams.set('detail', detail.slice(0, 400));
  return NextResponse.redirect(u);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code  = url.searchParams.get('code')  || '';
  const state = url.searchParams.get('state') || '';

  try {
    // 1) state -> verifier/redirect
    const st = await query<{ code_verifier: string; redirect_to: string }>(
      `DELETE FROM public.oauth_states
         WHERE state = $1
         RETURNING code_verifier, COALESCE(redirect_to,'/') AS redirect_to`,
      [state]
    );
    if (!st.rowCount || !code) return redir(url.origin, 'state', 'bad_state_or_code');
    const { code_verifier, redirect_to } = st.rows[0];

    // 2) обмен кода на токены (PKCE)
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code,
        code_verifier,
        grant_type: 'authorization_code',
        redirect_uri: `${url.origin}/api/auth/google/callback`,
      }),
    });
    if (!tokenRes.ok) return redir(url.origin, 'token', `http_${tokenRes.status}`);
    const tokens: any = await tokenRes.json();
    if (!tokens?.access_token) return redir(url.origin, 'token', 'no_access_token');

    // 3) userinfo (email/name), НО аватар дальше не используем
    const meRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!meRes.ok) return redir(url.origin, 'userinfo', `http_${meRes.status}`);
    const me: { sub: string; email?: string; name?: string; picture?: string } = await meRes.json();
    if (!me?.sub) return redir(url.origin, 'userinfo', 'no_sub');

    // 4) найти/линкануть/создать
    await query('BEGIN');

    let uid: string | null = null;

    // 4.1: поиск по google_sub
    const bySub = await query<{ id: string }>(
      `SELECT id FROM public.users WHERE google_sub=$1 LIMIT 1`,
      [me.sub]
    );
    if (bySub.rowCount) uid = bySub.rows[0].id;

    // 4.2: поиск по email и линковка sub
    if (!uid && me.email) {
      const byEmail = await query<{ id: string }>(
        `SELECT id FROM public.users WHERE email=$1 LIMIT 1`,
        [me.email]
      );
      if (byEmail.rowCount) {
        uid = byEmail.rows[0].id;
        await query(`UPDATE public.users SET google_sub=$1 WHERE id=$2`, [me.sub, uid]);
      }
    }

    // 4.3: создать пользователя
    if (!uid) {
      const displayName = me.name ?? (me.email ? me.email.split('@')[0] : 'user');
      const created = await query<{ id: string }>(
        `INSERT INTO public.users (email, name, email_verified_at, google_sub, password_hash)
         VALUES ($1,$2,now(),$3,NULL)
         RETURNING id`,
        [me.email ?? null, displayName, me.sub]
      );
      uid = created.rows[0].id;
    }

    // 4.4: профиль — username не передаём (БД поставит DEFAULT public.mk_username()).
    await query(
      `INSERT INTO public.profiles (id) VALUES ($1)
       ON CONFLICT (id) DO NOTHING`,
      [uid]
    );

    // ВАЖНО: аватар НЕ трогаем. Обновляем только full_name (латиницей) и updated_at.
    const fullNameEn = translitRuToEn(me.name ?? (me.email ? me.email.split('@')[0] : null));

    await query(
      `UPDATE public.profiles
          SET full_name  = COALESCE($2, full_name),
              updated_at = now()
        WHERE id = $1`,
      [uid, fullNameEn]
    );

    await query('COMMIT');

    // 5) сессия и редирект
    const token = await signSession({
      sub: uid!,
      email: me.email ?? null,
      name: fullNameEn ?? null,
    });

    const res = NextResponse.redirect(new URL(redirect_to || '/', url.origin));
    setSessionCookieOn(res, token);
    return res;
  } catch (e: any) {
    try { await query('ROLLBACK'); } catch {}
    return redir(url.origin, 'internal', e?.message || String(e));
  }
}
