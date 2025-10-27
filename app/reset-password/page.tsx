// app/reset-password/page.tsx
'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';

export default function ResetPasswordPage() {
  const sp = useSearchParams();
  const router = useRouter();

  const token = sp.get('token') ?? '';

  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const MIN_PWD = 6;

  const pwdStrength = useMemo(() => {
    if (!pwd) return 0;
    let s = 0;
    if (pwd.length >= MIN_PWD) s++;
    if (/[A-ZА-Я]/.test(pwd)) s++;
    if (/[0-9]/.test(pwd)) s++;
    if (/[^\w\s]/.test(pwd)) s++;
    return Math.min(s, 4);
  }, [pwd]);

  const disabled = useMemo(() => {
    if (!token) return true;
    if (loading) return true;
    if (!pwd || !pwd2) return true;
    if (pwd.length < MIN_PWD) return true;
    if (pwd !== pwd2) return true;
    return false;
  }, [token, loading, pwd, pwd2]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;
    setErr(null);
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, password: pwd }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      setMsg('Пароль обновлён! Сейчас вернёмся на главную…');
      setTimeout(() => router.push('/?reset=1'), 800);
    } catch (e: any) {
      setErr(e?.message || 'Не удалось обновить пароль');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen relative flex items-center justify-center px-4 py-8 overflow-hidden">
        <div
          className="absolute inset-0 -z-10"
          aria-hidden
          style={{
            background:
              'radial-gradient(1200px 600px at 10% -10%, rgba(99,102,241,0.10), transparent), radial-gradient(800px 400px at 90% 110%, rgba(147,51,234,0.10), transparent)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-40 [mask-image:radial-gradient(circle_at_center,black,transparent_70%)]"
          style={{
            backgroundSize: '300% 300%',
            animation: 'gradientShift 18s ease infinite',
            backgroundImage: 'linear-gradient(90deg, rgba(99,102,241,0.08), rgba(147,51,234,0.08))',
          }}
        />
        <div className="w-full max-w-md">
          <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-indigo-500/40 via-purple-500/30 to-indigo-500/20 shadow-2xl shadow-indigo-500/10">
            <div className="relative z-10 rounded-2xl bg-white/70 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200/60 dark:border-zinc-800/60 p-6 sm:p-8">
              <div className="mb-4 flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-400">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>Неверная ссылка: отсутствует токен сброса пароля.</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <Link href="/forgot-password" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                  Запросить ссылку снова
                </Link>
                <Link href="/" className="text-zinc-600 dark:text-zinc-400 hover:underline">
                  На главную
                </Link>
              </div>
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
            Если письма нет, проверьте «Спам».
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 py-8 overflow-hidden">
      {/* Background gradient (theme-aware) */}
      <div
        className="absolute inset-0 -z-10"
        aria-hidden
        style={{
          background:
            'radial-gradient(1200px 600px at 10% -10%, rgba(99,102,241,0.10), transparent), radial-gradient(800px 400px at 90% 110%, rgba(147,51,234,0.10), transparent)',
        }}
      />
      {/* Animated subtle stripes */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-40 [mask-image:radial-gradient(circle_at_center,black,transparent_70%)]"
        style={{
          backgroundSize: '300% 300%',
          animation: 'gradientShift 18s ease infinite',
          backgroundImage: 'linear-gradient(90deg, rgba(99,102,241,0.08), rgba(147,51,234,0.08))',
        }}
      />

      <div className="w-full max-w-md">
        <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-indigo-500/40 via-purple-500/30 to-indigo-500/20 shadow-2xl shadow-indigo-500/10">
          {/* Декоративный арт как на логин-страницах */}
          <img
            src="/assets/mangalogin.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute z-20 select-none drop-shadow-md h-[210px] left-[250px] -top-[620px] sm:-top-[240px] md:-top-[260px] lg:-top-[160px]"
            decoding="async"
            fetchPriority="high"
          />
          <div className="relative z-10 rounded-2xl bg-white/70 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200/60 dark:border-zinc-800/60 p-6 sm:p-8 pt-16">
            <div className="mb-6 text-center">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Новый пароль</h1>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Введите новый пароль для вашего аккаунта.
              </p>
            </div>

            {msg && !err && (
              <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>{msg}</span>
              </div>
            )}
            {err && (
              <div className="mb-4 flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-400">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>{err}</span>
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              {/* New password */}
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Новый пароль (минимум {MIN_PWD} символов)
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-4 w-4 text-zinc-400" />
                  </div>
                  <input
                    type={show1 ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white/80 dark:bg-zinc-800/80 px-10 py-2.5 pr-11 text-[15px] shadow-sm placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    value={pwd}
                    onChange={(e) => setPwd(e.target.value)}
                    placeholder="••••••••"
                    minLength={MIN_PWD}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShow1((s) => !s)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    aria-label={show1 ? 'Скрыть пароль' : 'Показать пароль'}
                  >
                    {show1 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {/* Strength meter */}
                <div className="mt-2 flex gap-1" aria-hidden>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full ${
                        i < pwdStrength ? 'bg-indigo-500' : 'bg-zinc-300 dark:bg-zinc-700'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Repeat password */}
              <div>
                <label className="mb-1 block text-sm font-medium">Повторите пароль</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-4 w-4 text-zinc-400" />
                  </div>
                  <input
                    type={show2 ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white/80 dark:bg-zinc-800/80 px-10 py-2.5 pr-11 text-[15px] shadow-sm placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    value={pwd2}
                    onChange={(e) => setPwd2(e.target.value)}
                    placeholder="••••••••"
                    minLength={MIN_PWD}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShow2((s) => !s)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    aria-label={show2 ? 'Скрыть пароль' : 'Показать пароль'}
                  >
                    {show2 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {pwd2 && pwd !== pwd2 && (
                  <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">Пароли не совпадают</p>
                )}
              </div>

              <button
                type="submit"
                disabled={disabled}
                className={`group relative w-full overflow-hidden rounded-xl py-3 text-white transition focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
                  disabled
                    ? 'bg-indigo-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40'
                }`}
              >
                <span className="inline-flex items-center justify-center gap-2">
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? 'Обновляем…' : 'Сохранить пароль'}
                </span>
              </button>
            </form>

            {/* Links */}
            <div className="mt-6 flex items-center justify-between text-sm">
              <Link href="/login" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                Вернуться ко входу
              </Link>
              <Link href="/forgot-password" className="text-zinc-600 dark:text-zinc-400 hover:underline">
                Запросить новую ссылку
              </Link>
            </div>

            {/* Back home */}
            <div className="mt-6 text-center">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                На главную
              </Link>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
          Если письма нет, проверьте «Спам».
        </p>
      </div>
    </div>
  );
}
