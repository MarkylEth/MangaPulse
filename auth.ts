// auth.ts
import NextAuth, { DefaultSession } from 'next-auth';
import Google from 'next-auth/providers/google';
import PostgresAdapter from '@auth/pg-adapter';
import { pool } from '@/lib/db';

/** env helper */
function need(name: string) {
  const v = process.env[name];
  if (!v) {
    console.error(`[auth] Missing env ${name}`);
    throw new Error(`Missing env ${name}`);
  }
  return v;
}

/** мост authjs.users(id:text) -> public.users(id:uuid) */
async function ensureBridgeTable() {
  await pool.query(`
    create table if not exists public.auth_bridge (
      auth_user_id text primary key,
      app_user_id  uuid not null references public.users(id) on delete cascade
    );
    create index if not exists auth_bridge_app_user_id_idx
      on public.auth_bridge(app_user_id);
  `);
}

async function ensureAppUser(input: {
  email: string;
  name?: string | null;
  picture?: string | null;
  googleSub?: string | null;
  authUserId: string; // authjs.users.id
}) {
  const { email, name, picture, googleSub, authUserId } = input;

  await ensureBridgeTable();

  // если мост уже есть — вернуть id
  const b = await pool.query<{ app_user_id: string }>(
    `select app_user_id from public.auth_bridge where auth_user_id = $1`,
    [authUserId],
  );
  if (b.rowCount) return b.rows[0].app_user_id;

  // upsert в public.users
  const u = await pool.query<{ id: string }>(
    `
    insert into public.users (email, name, email_verified_at)
    values ($1, $2, now())
    on conflict (email) do update
      set name = coalesce(excluded.name, public.users.name)
    returning id
  `,
    [email, name ?? null],
  );
  const appUserId = u.rows[0].id;

  // upsert профиль
  const baseNick = (name && name.trim()) || email.split('@')[0];
  const fullName = name?.trim() || baseNick;

  try {
    await pool.query(
      `
      insert into public.profiles (id, username, full_name, avatar_url, updated_at)
      values ($1, $2, $3, $4, now())
      on conflict (id) do update
        set full_name  = coalesce(excluded.full_name, public.profiles.full_name),
            avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
            updated_at = now()
    `,
      [appUserId, baseNick, fullName, picture ?? null],
    );
  } catch (e: any) {
    if (e?.code === '23505') {
      const nick2 = `${baseNick}_${Math.random().toString(36).slice(2, 6)}`;
      await pool.query(
        `
        insert into public.profiles (id, username, full_name, avatar_url, updated_at)
        values ($1, $2, $3, $4, now())
        on conflict (id) do update
          set full_name  = coalesce(excluded.full_name, public.profiles.full_name),
              avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
              updated_at = now()
      `,
        [appUserId, nick2, fullName, picture ?? null],
      );
    } else {
      console.error('[profiles upsert error]', e);
      throw e;
    }
  }

  // опциональная колонка google_sub
  try {
    await pool.query(
      `alter table public.users add column if not exists google_sub text`,
    );
    if (googleSub) {
      await pool.query(
        `update public.users set google_sub = $1 where id = $2`,
        [googleSub, appUserId],
      );
    }
  } catch (err) {
    console.warn('[users.google_sub warn]', err);
  }

  // мост
  await pool.query(
    `
    insert into public.auth_bridge (auth_user_id, app_user_id)
    values ($1, $2)
    on conflict (auth_user_id) do nothing
  `,
    [authUserId, appUserId],
  );

  return appUserId;
}

/** расширяем тип Session — id обязателен */
declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & { id: string };
  }
}

export const { handlers, auth } = NextAuth({
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
  adapter: PostgresAdapter(pool as any),
  providers: [
    Google({
      clientId: need('GOOGLE_CLIENT_ID'),
      clientSecret: need('GOOGLE_CLIENT_SECRET'),
    }),
  ],
  events: {
    async signIn({ user, account }) {
      await ensureAppUser({
        email: user.email!,
        name: user.name ?? null,
        picture: user.image ?? null,
        googleSub: account?.provider === 'google' ? account.providerAccountId : null,
        authUserId: user.id,
      });
    },
  },
  callbacks: {
    async session({ session, token }) {
      if (token?.sub) {
        const q = await pool.query<{ app_user_id: string }>(
          `select app_user_id from public.auth_bridge where auth_user_id = $1`,
          [token.sub],
        );
        if (q.rowCount) {
          (session.user as any) ||= {};
          (session.user as any).id = q.rows[0].app_user_id;
        }
      }
      return session;
    },
    // После входа редиректим на свой "мостик" — там поставим mp_session
    async redirect({ baseUrl }) {
      return `${baseUrl}/api/auth/after`;
    },
  },
});
