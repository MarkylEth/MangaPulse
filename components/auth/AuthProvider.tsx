// components/auth/AuthProvider.tsx
'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

/* ==================== TYPES ==================== */
// ✅ ЕДИНЫЙ тип для всего приложения
export type AuthUser = {
  id: string;
  email: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  role: 'admin' | 'moderator' | 'user';
};

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  isGuest: boolean;
  setUser: (user: AuthUser | null) => void;
  refresh: () => Promise<void>;
};

/* ==================== CONTEXT ==================== */
const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isGuest: true,
  setUser: () => {},
  refresh: async () => {},
});

/* ==================== PROVIDER ==================== */
export function AuthProvider({
  children,
  initialUser = null,
}: {
  children: React.ReactNode;
  initialUser?: AuthUser | null;
}) {
  const [user, setUserState] = useState<AuthUser | null>(initialUser);
  const [isLoading, setIsLoading] = useState(!initialUser);

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
        cache: 'no-store',
      });

      const data = await response.json();

      if (!response.ok || !data?.user) {
        setUserState(null);
        try {
          localStorage.removeItem('mp:user');
          sessionStorage.removeItem('mp:user');
        } catch {}
        return;
      }

      // ✅ Нормализуем данные под единый тип
      const normalizedUser: AuthUser = {
        id: data.user.id,
        email: data.user.email,
        username: data.user.username,
        display_name: data.user.display_name ?? null,
        avatar_url: data.user.avatar_url ?? null,
        role: data.user.role ?? 'user',
      };

      setUserState(normalizedUser);

      try {
        localStorage.setItem('mp:user', JSON.stringify(normalizedUser));
      } catch {}
    } catch (error) {
      console.error('[AuthProvider] Failed to fetch user:', error);
      setUserState(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!initialUser) {
      fetchUser();
    }
  }, [initialUser]);

  const setUser = (newUser: AuthUser | null) => {
    setUserState(newUser);
    try {
      if (newUser) {
        localStorage.setItem('mp:user', JSON.stringify(newUser));
      } else {
        localStorage.removeItem('mp:user');
        sessionStorage.removeItem('mp:user');
      }
    } catch {}
  };

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isGuest: !user?.id,
      setUser,
      refresh: fetchUser,
    }),
    [user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* ==================== HOOKS ==================== */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

/**
 * ✅ Хук для защищённых страниц
 * Автоматически редиректит на /login если не авторизован
 */
export function useRequireAuth() {
  const { user, isLoading } = useAuth();
  const router = typeof window !== 'undefined' ? require('next/navigation').useRouter() : null;

  useEffect(() => {
    if (!isLoading && !user && router) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  return { user, isLoading };
}

/**
 * ✅ Хук для проверки роли
 */
export function useRequireRole(role: 'admin' | 'moderator') {
  const { user, isLoading } = useAuth();
  const router = typeof window !== 'undefined' ? require('next/navigation').useRouter() : null;

  const hasAccess = useMemo(() => {
    if (!user) return false;
    if (role === 'admin') return user.role === 'admin';
    return user.role === 'admin' || user.role === 'moderator';
  }, [user, role]);

  useEffect(() => {
    if (!isLoading && !hasAccess && router) {
      router.push('/');
    }
  }, [hasAccess, isLoading, router]);

  return { user, hasAccess, isLoading };
}