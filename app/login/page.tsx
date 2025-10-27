'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  Mail,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';

// ===================== Types =====================
type Mode = 'login' | 'register';
type ApiError = { ok: false; error?: string; detail?: any; message?: string };

export default function LoginPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setUser } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showPwd, setShowPwd] = useState(false);

  const MIN_PWD = 6;

  // URL state (verify/reset)
  useEffect(() => {
    const verified = searchParams.get('verified');
    const alreadyUsed = searchParams.get('already_used');
    const error = searchParams.get('error');
    const reset = searchParams.get('reset');

    if (verified === '1') {
      if (alreadyUsed === '1') {
        setMsg('Ваш email уже был подтвержден ранее. Теперь вы можете войти.');
      } else {
        setMsg('Email успешно подтвержден! Теперь вы можете войти с паролем.');
      }
      setMode('login');
    } else if (reset === '1') {
      setMsg('Пароль успешно обновлён! Теперь войдите с новым паролем.');
      setMode('login');
    } else if (error) {
      const errorMessages: Record<string, string> = {
        missing_token: 'Отсутствует токен подтверждения',
        invalid_token: 'Неверный или недействительный токен',
        token_expired: 'Срок действия токена истек. Попробуйте зарегистрироваться снова.',
        internal: 'Произошла внутренняя ошибка. Попробуйте позже.',
      };
      setErr(errorMessages[error] || 'Произошла ошибка');
    }
  }, [searchParams]);

  const disabled = useMemo(() => {
    if (loading) return true;
    if (!email) return true;
    if (!password || password.length < MIN_PWD) return true;
    if (mode === 'register' && username.trim().length < 2) return true;
    return false;
  }, [loading, email, password, username, mode]);

  const pwdStrength = useMemo(() => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= MIN_PWD) score += 1;
    if (/[A-ZА-Я]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^\w\s]/.test(password)) score += 1;
    return Math.min(score, 4);
  }, [password]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;

    setErr(null);
    setMsg(null);
    setLoading(true);

    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const body =
        mode === 'register'
          ? { email, password, username: username.trim() }
          : { email, password };

      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const json = await r.json().catch(() => ({}));

      if (!r.ok || (json && (json as ApiError).error)) {
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
        if (j.error === 'user_banned') {
          setErr('Ваш аккаунт заблокирован.');
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
        setEmail('');
        setPassword('');
        setUsername('');
      } else {
        if ((json as any)?.user) {
          setUser((json as any).user);
          router.push('/');
          router.refresh();
        }
      }
    } catch (e: any) {
      setErr(e?.message || 'Ошибка сети');
    } finally {
      setLoading(false);
    }
  }

  // ===================== UI =====================
  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 py-8 overflow-hidden">
      {/* Background gradient (theme-aware) */}
      <div
        className="absolute inset-0 -z-10"
        aria-hidden
        style={{
          background:
            'radial-gradient(1200px 600px at 10% -10%, rgba(99,102,241,0.10), transparent),\n             radial-gradient(800px 400px at 90% 110%, rgba(147,51,234,0.10), transparent)',
        }}
      />
      {/* Animated subtle stripes */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-40 [mask-image:radial-gradient(circle_at_center,black,transparent_70%)]"
        style={{
          backgroundSize: '300% 300%',
          animation: 'gradientShift 18s ease infinite',
          backgroundImage:
            'linear-gradient(90deg, rgba(99,102,241,0.08), rgba(147,51,234,0.08))',
        }}
      />

      <div className="w-full max-w-md">
        {/* Card with gradient border ring */}
          <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-indigo-500/40 via-purple-500/30 to-indigo-500/20 shadow-2xl shadow-indigo-500/10">
            {/* 👇 GIF поверх карточки */}
              <img
                src="/assets/mangalogin.png"
                alt=""
                aria-hidden="true"
                className="
                  pointer-events-none absolute z-20 select-none drop-shadow-md
                  h-[210px]
                  left-[250px]          /* привязка к правому краю */
                  -top-[620px]         /* базовое смещение вверх */
                  sm:-top-[240px]
                  md:-top-[260px]      /* ← было 160x */
                  lg:-top-[160px]
                "
                decoding="async"
                fetchPriority="high"
              />
            
            <div className="relative z-10 rounded-2xl bg-white/70 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200/60 dark:border-zinc-800/60 p-6 sm:p-8 pt-16">
            {/* Header */}
            <div className="mb-6 text-center">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {mode === 'login' ? 'Вход' : 'Регистрация'}
              </h1>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {mode === 'login' ? 'Добро пожаловать обратно' : 'Создайте новый аккаунт'}
              </p>
            </div>

            {/* Alerts */}
            {msg && (
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

            {/* Tabs */}
            <div className="grid grid-cols-2 gap-2 mb-6">
              <button
                onClick={() => setMode('login')}
                className={`group relative rounded-xl py-2.5 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/60 ${
                  mode === 'login'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                    : 'bg-zinc-100/70 dark:bg-zinc-800/70 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200/70 dark:hover:bg-zinc-700/70'
                }`}
              >
                Вход
              </button>
              <button
                onClick={() => setMode('register')}
                className={`group relative rounded-xl py-2.5 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/60 ${
                  mode === 'register'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                    : 'bg-zinc-100/70 dark:bg-zinc-800/70 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200/70 dark:hover:bg-zinc-700/70'
                }`}
              >
                Регистрация
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="mb-1 block text-sm font-medium">E-mail</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Mail className="h-4 w-4 text-zinc-400" />
                  </div>
                  <input
                    type="email"
                    autoComplete="email"
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white/80 dark:bg-zinc-800/80 px-10 py-2.5 text-[15px] shadow-sm placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              {/* Username (register only) */}
              {mode === 'register' && (
                <div>
                  <label className="mb-1 block text-sm font-medium">Никнейм (от 4 символов)</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <UserIcon className="h-4 w-4 text-zinc-400" />
                    </div>
                    <input
                      type="text"
                      autoComplete="username"
                      className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white/80 dark:bg-zinc-800/80 px-10 py-2.5 text-[15px] shadow-sm placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Ваш никнейм"
                      minLength={2}
                      maxLength={32}
                      required
                    />
                  </div>
                </div>
              )}

              {/* Password */}
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Пароль (минимум {MIN_PWD} символов)
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-4 w-4 text-zinc-400" />
                  </div>
                  <input
                    type={showPwd ? 'text' : 'password'}
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white/80 dark:bg-zinc-800/80 px-10 py-2.5 pr-11 text-[15px] shadow-sm placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={MIN_PWD}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((s) => !s)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    aria-label={showPwd ? 'Скрыть пароль' : 'Показать пароль'}
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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

              {/* Submit */}
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
                  {loading ? 'Обработка…' : mode === 'register' ? 'Зарегистрироваться' : 'Войти'}
                </span>
              </button>
            </form>

            {/* Links */}
            <div className="mt-6 flex items-center justify-between text-sm">
              {mode === 'login' ? (
                <>
                  <Link href="/forgot-password" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                    Забыли пароль?
                  </Link>
                  <Link href="/api/auth/send" className="text-zinc-600 dark:text-zinc-400 hover:underline">
                    Отправить подтверждение заново
                  </Link>
                </>
              ) : (
                <Link href="/api/auth/send" className="mx-auto text-zinc-600 dark:text-zinc-400 hover:underline">
                  Не получили письмо? Отправить заново
                </Link>
              )}
            </div>

            {/* Back home */}
            <div className="mt-6 text-center">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Вернуться на главную
              </Link>
            </div>
          </div>
        </div>

        {/* Tiny legal footnote */}
        <p className="mt-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
          Нажимая «{mode === 'register' ? 'Зарегистрироваться' : 'Войти'}», вы соглашаетесь с правилами сообщества.
        </p>
      </div>
    </div>
  );
}
