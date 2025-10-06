// components/auth/AuthModal.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
};

type ApiError = { ok: false; error?: string; detail?: any; message?: string };

export default function AuthModal({ isOpen, onClose, initialMode = 'register' }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) {
      setMsg(null);
      setErr(null);
      setLoading(false);
      setGoogleLoading(false);
      setPassword('');
    }
  }, [isOpen]);

  useEffect(() => setMode(initialMode), [initialMode]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const disabled = useMemo(() => {
    if (loading || googleLoading) return true;
    if (!email) return true;
    if (mode === 'register' && (!nickname || password.length < 6)) return true;
    if (mode === 'login' && password.length < 1) return true;
    return false;
  }, [loading, googleLoading, email, nickname, password, mode]);

  const { setUser } = useAuth();
  const router = useRouter();

  async function handleRegister() {
    setErr(null);
    setMsg(null);
    setLoading(true);
    try {
      const r = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name: nickname, password, mode: 'signup' }),
      });
      const json = await r.json();
      if (!r.ok || !json?.ok) {
        const j = json as ApiError;
        const nice =
          j.detail?.message ||
          j.detail?.error ||
          (typeof j.detail === 'string' ? j.detail : j.detail ? JSON.stringify(j.detail) : undefined) ||
          j.message ||
          j.error ||
          `HTTP ${r.status}`;
        setErr(nice);
        return;
      }
      setMsg('Письмо отправлено. Проверьте почту и перейдите по ссылке для подтверждения.');
    } catch (e: any) {
      setErr(e?.message || 'Ошибка сети');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    setErr(null);
    setMsg(null);
    setLoading(true);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const json = await r.json();
      if (!r.ok || !json?.ok) {
        setErr(json?.error || `HTTP ${r.status}`);
        return;
      }

      // Базовый объект пользователя из ответа логина
      let loggedUser = json.user ?? null;

      // Подтягиваем профиль и добавляем username/nickname
      try {
        const r2 = await fetch('/api/profile/me', { credentials: 'include', cache: 'no-store' });
        const j2 = await r2.json().catch(() => ({}));
        if (r2.ok && j2?.profile?.username) {
          loggedUser = {
            ...(loggedUser || {}),
            username: j2.profile.username,
            nickname: j2.profile.username,
          };
        }
      } catch {
        // не критично
      }

      // Передаём готовое ЗНАЧЕНИЕ, а не функцию-апдейтер
      setUser(loggedUser);

      setMsg('Успешный вход');
      router.refresh?.();
      onClose?.();
    } catch (e: any) {
      setErr(e?.message || 'Ошибка сети');
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;
    if (mode === 'register') await handleRegister();
    else await handleLogin();
  }

  function handleGoogle() {
    try {
      setErr(null);
      setMsg(null);
      setGoogleLoading(true);
      const after = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';
      window.location.href = `/api/auth/google?redirect_to=${encodeURIComponent(after || '/')}`;
    } catch (e: any) {
      setGoogleLoading(false);
      setErr(e?.message || 'Ошибка при переходе к Google');
    }
  }

  if (!isOpen || !mounted) return null;

  const modalUi = (
    <div className="fixed inset-0 z-[1000]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-md rounded-2xl border bg-white p-5 shadow-xl dark:bg-slate-900 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold dark:text-white">{mode === 'register' ? 'Регистрация' : 'Вход'}</h3>
          <button onClick={onClose} className="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-slate-800" aria-label="Закрыть">
            ✕
          </button>
        </div>

        <button
          onClick={handleGoogle}
          disabled={googleLoading}
          className={`w-full rounded-lg py-2 border dark:border-slate-700 dark:text-slate-100 ${
            googleLoading ? 'opacity-60' : 'hover:bg-gray-50 dark:hover:bg-slate-800'
          }`}
        >
          {googleLoading ? 'Переход к Google…' : 'Войти через Google'}
        </button>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200 dark:bg-slate-700" />
          <span className="text-xs text-gray-500 dark:text-slate-400">или</span>
          <div className="h-px flex-1 bg-gray-200 dark:bg-slate-700" />
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => setMode('login')}
            className={`rounded px-3 py-2 text-sm ${mode === 'login' ? 'bg-blue-600 text-white' : 'border dark:border-slate-700 dark:text-slate-200'}`}
          >
            Вход по e-mail
          </button>
          <button
            onClick={() => setMode('register')}
            className={`rounded px-3 py-2 text-sm ${mode === 'register' ? 'bg-blue-600 text-white' : 'border dark:border-slate-700 dark:text-slate-200'}`}
          >
            Регистрация по e-mail
          </button>
        </div>

        <form className="space-y-3" onSubmit={onSubmit}>
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-white">E-mail</label>
            <input
              type="email"
              autoComplete="email"
              className="w-full rounded-lg border px-3 py-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          {mode === 'register' ? (
            <>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-white">Ник</label>
                <input
                  autoComplete="nickname"
                  className="w-full rounded-lg border px-3 py-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Ваш ник"
                  maxLength={32}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-white">Пароль</label>
                <input
                  type="password"
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full rounded-lg border px-3 py-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Минимум 6 символов"
                  required
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-white">Пароль</label>
              <input
                type="password"
                autoComplete="current-password"
                className="w-full rounded-lg border px-3 py-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ваш пароль"
                required
              />
            </div>
          )}

          {!!err && <p className="text-sm text-red-600">{err}</p>}
          {!!msg && <p className="text-sm text-green-600">{msg}</p>}

          <button
            type="submit"
            disabled={disabled}
            className={`w-full rounded-lg py-2 text-white ${disabled ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {loading ? 'Отправка…' : mode === 'register' ? 'Зарегистрироваться' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );

  return createPortal(modalUi, document.body);
}
