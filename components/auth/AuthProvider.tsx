//components\auth\AuthProvider.tsx
'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type AuthUser = {
  id: string | number;
  email?: string | null;
  name?: string | null;
  username?: string | null;
  nickname?: string | null;
  role?: string | null;
  avatar_url?: string | null;
};

type AuthCtx = {
  user: AuthUser | null;
  isGuest: boolean;
  setUser: (u: AuthUser | null) => void;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  isGuest: true,
  setUser: () => {},
});

export function AuthProvider({
  children,
  initialUser = null,
}: {
  children: React.ReactNode;
  initialUser?: AuthUser | null;
}) {
  const [user, setUser] = useState<AuthUser | null>(initialUser ?? null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const r = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' });
        const j = await r.json().catch(() => ({} as any));

        // если эндпоинт вернул user:null — гость
        if (!r.ok || !j?.user) {
          if (alive) setUser(null);
          try {
            localStorage.removeItem('mp:user');
            sessionStorage.removeItem('mp:user');
          } catch {}
          return;
        }

        // базовые поля из user
        let u: AuthUser = {
          id: j.user.id,
          email: j.user.email ?? null,
          name: j.user.name ?? null,
          username: j.user.username ?? null,
          nickname: j.user.nickname ?? null,
          role: j.user.role ?? null,
          avatar_url: j.user.avatar_url ?? null,
        };

        // если сервер уже объединяет profile — аккуратно доклеим
        const p = j.profile ?? null;
        if (p) {
          u = {
            ...u,
            username: p.username ?? u.username ?? null,
            nickname: p.nickname ?? u.nickname ?? p.username ?? null,
            avatar_url: p.avatar_url ?? u.avatar_url ?? null,
            role: p.role ?? u.role ?? null,
          };
        }

        if (alive) {
          setUser(u);
          try {
            localStorage.setItem('mp:user', JSON.stringify(u));
          } catch {}
        }
      } catch {
        if (alive) setUser(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      isGuest: !user?.id,
      setUser: (u: AuthUser | null) => {
        setUser(u);
        try {
          if (u) localStorage.setItem('mp:user', JSON.stringify(u));
          else {
            localStorage.removeItem('mp:user');
            sessionStorage.removeItem('mp:user');
          }
        } catch {}
      },
    }),
    [user]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
