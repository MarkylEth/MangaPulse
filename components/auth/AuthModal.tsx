// components/auth/AuthModal.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';

type Mode = 'login' | 'register' | 'forgot';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: Extract<Mode, 'login' | 'register'>;
};

type ApiError = { ok: false; error?: string; detail?: any; message?: string };

export default function AuthModal({ isOpen, onClose, initialMode = 'login' }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
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
      setNickname('');
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

  // единый минимум: 8 символов (как в API reset)
  const MIN_PWD = 6;

  const disabled = useMemo(() => {
    if (loading || googleLoading) return true;
    if (!email) return true;

    if (mode === 'login') {
      if (!password || password.length < MIN_PWD) return true;
    }
    if (mode === 'register') {
      if (!password || password.length < MIN_PWD) return true;
      if (nickname.trim().length < 2) return true;
    }
    if (mode === 'forgot') {
      // только email
      return false; // email уже проверили выше
    }
    return false;
  }, [loading, googleLoading, email, password, nickname, mode]);

  const { setUser } = useAuth();
  const router = useRouter();

  async function submitLoginOrRegister() {
    setErr(null);
    setMsg(null);
    setLoading(true);

    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const body =
        mode === 'register'
          ? { email, password, name: nickname.trim() }
          : { email, password };

      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const json = await r.json().catch(() => ({}));

      if (!r.ok || (json && json.error)) {
        const j = json as ApiError;

        if (j.error === 'email_not_verified') {
          setErr('Email не подтверждён. Проверьте почту и перейдите по ссылке из письма.');
          return;
        }
        if (j.error === 'email_already_registered') {
          setErr('Этот email уже зарегистрирован. Попробуйте войти.');
          setMode('login');
          return;
        }
        if (j.error === 'weak_password') {
          setErr(`Пароль должен содержать минимум ${MIN_PWD} символов.`);
          return;
        }
        if (j.error === 'invalid_credentials') {
          setErr('Неверный email или пароль.');
          return;
        }

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

      if (mode === 'register') {
        setMsg('Регистрация успешна! Проверьте почту и подтвердите email. Ссылка действует 24 часа.');
      } else {
        if (json?.user) {
          setUser(json.user);
          router.refresh();
          onClose();
        }
      }
    } catch (e: any) {
      setErr(e?.message || 'Ошибка сети');
    } finally {
      setLoading(false);
    }
  }

  async function submitForgot() {
    setErr(null);
    setMsg(null);
    setLoading(true);
    try {
      const r = await fetch('/api/auth/password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });
      // всегда 200 (без утечек), но попытаемся прочитать json
      await r.json().catch(() => ({}));
      setMsg('Если такой email зарегистрирован, мы отправили ссылку для сброса пароля.');
    } catch (e: any) {
      setErr(e?.message || 'Не удалось отправить письмо. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  }

  function handleGoogle() {
    try {
      setErr(null);
      setMsg(null);
      setGoogleLoading(true);
      const after =
        typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';
      window.location.href = `/api/auth/google?redirect_to=${encodeURIComponent(after || '/')}`;
    } catch (e: any) {
      setGoogleLoading(false);
      setErr(e?.message || 'Ошибка при переходе к Google');
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;
    if (mode === 'forgot') void submitForgot();
    else void submitLoginOrRegister();
  }

  if (!isOpen || !mounted) return null;

  const modalUi = (
    <div className="fixed inset-0 z-[1000]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-md rounded-2xl border bg-white p-5 shadow-xl dark:bg-slate-900 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold dark:text-white">
            {mode === 'register' ? 'Регистрация' : mode === 'login' ? 'Вход' : 'Сброс пароля'}
          </h3>
          <button
            onClick={onClose}
            className="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-slate-800"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>

        {mode !== 'forgot' && (
          <>
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
                className={`rounded px-3 py-2 text-sm ${
                  mode === 'login' ? 'bg-blue-600 text-white' : 'border dark:border-slate-700 dark:text-slate-200'
                }`}
              >
                Вход
              </button>
              <button
                onClick={() => setMode('register')}
                className={`rounded px-3 py-2 text-sm ${
                  mode === 'register' ? 'bg-blue-600 text-white' : 'border dark:border-slate-700 dark:text-slate-200'
                }`}
              >
                Регистрация
              </button>
            </div>
          </>
        )}

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

          {mode !== 'forgot' && (
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-white">
                Пароль (минимум {MIN_PWD} символов)
              </label>
              <input
                type="password"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                className="w-full rounded-lg border px-3 py-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={MIN_PWD}
                required
              />
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-white">Ник (от 2 символов)</label>
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
          )}

          {!!err && <p className="text-sm text-red-600">{err}</p>}
          {!!msg && <p className="text-sm text-green-600">{msg}</p>}

          <button
            type="submit"
            disabled={disabled}
            className={`w-full rounded-lg py-2 text-white ${
              disabled ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading
              ? 'Обработка…'
              : mode === 'register'
              ? 'Зарегистрироваться'
              : mode === 'login'
              ? 'Войти'
              : 'Отправить ссылку'}
          </button>
        </form>

        <div className="mt-3 text-sm flex items-center justify-between text-gray-600 dark:text-slate-300">
          {mode === 'login' && (
            <>
              <button
                className="underline underline-offset-2 hover:text-blue-600"
                onClick={() => setMode('forgot')}
              >
                Забыли пароль?
              </button>
              <span />
            </>
          )}
          {mode === 'forgot' && (
            <>
              <span />
              <button
                className="underline underline-offset-2 hover:text-blue-600"
                onClick={() => setMode('login')}
              >
                Вернуться ко входу
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalUi, document.body);
}
