// app/api/auth/google/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { query } from '@/lib/db';
export const dynamic = 'force-dynamic';

function b64url(buf: Buffer) { return buf.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function sha256b64url(s: string) { return b64url(crypto.createHash('sha256').update(s).digest()); }

async function ensureStateTable() {
  await query(`
    create table if not exists public.oauth_states(
      state text primary key,
      code_verifier text not null,
      nonce text,
      redirect_to text,
      created_at timestamptz not null default now()
    );
    delete from public.oauth_states where created_at < now() - interval '1 day';
  `);
}

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI ||
    `${req.nextUrl.origin.replace(/\/+$/,'')}/api/auth/google/callback`;

  const redirectParam = req.nextUrl.searchParams.get('redirect_to') ?? '/';
  const redirectTo = redirectParam.startsWith('/') ? redirectParam : '/';

  const codeVerifier  = b64url(crypto.randomBytes(32));
  const codeChallenge = sha256b64url(codeVerifier);
  const state = b64url(crypto.randomBytes(16));
  const nonce = b64url(crypto.randomBytes(16));

  await ensureStateTable();
  await query(
    `insert into public.oauth_states(state, code_verifier, nonce, redirect_to)
     values ($1,$2,$3,$4)`,
    [state, codeVerifier, nonce, redirectTo]
  );

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'select_account consent',
    include_granted_scopes: 'true',
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}

