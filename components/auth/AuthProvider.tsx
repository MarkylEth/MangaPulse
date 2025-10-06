'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type AuthUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  username?: string | null;   // ← важно
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

export function AuthProvider({ children, initialUser = null }: { children: React.ReactNode; initialUser?: AuthUser | null }) {
  const [user, setUser] = useState<AuthUser | null>(initialUser ?? null);

  // подгружаем при маунте актуального пользователя + его профиль (username)
  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        // 1) кто залогинен (user)
        const r1 = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' });
        const j1 = await r1.json().catch(() => ({}));
        if (!r1.ok || !j1?.user) {
          if (isMounted) setUser(null);
          try { localStorage.removeItem('mp:user'); sessionStorage.removeItem('mp:user'); } catch {}
          return;
        }

        let u: AuthUser = j1.user;

        // 2) подтягиваем профиль (username и т.п.)
        const r2 = await fetch('/api/profile/me', { credentials: 'include', cache: 'no-store' });
        const j2 = await r2.json().catch(() => ({}));
        if (r2.ok && j2?.profile) {
          u = {
            ...u,
            username: j2.profile.username ?? u.username ?? null,
            nickname: j2.profile.nickname ?? u.nickname ?? j2.profile.username ?? null,
            avatar_url: j2.profile.avatar_url ?? u.avatar_url ?? null,
            role: j2.profile.role ?? u.role ?? null,
          };
        }

        if (isMounted) {
          setUser(u);
          try { localStorage.setItem('mp:user', JSON.stringify(u)); } catch {}
        }
      } catch {
        if (isMounted) setUser(null);
      }
    })();

    return () => { isMounted = false; };
  }, []);

  const value = useMemo(() => ({
    user,
    isGuest: !user?.id,
    setUser: (u: AuthUser | null) => {
      setUser(u);
      try {
        if (u) localStorage.setItem('mp:user', JSON.stringify(u));
        else { localStorage.removeItem('mp:user'); sessionStorage.removeItem('mp:user'); }
      } catch {}
    },
  }), [user]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
