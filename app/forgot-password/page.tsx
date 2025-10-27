// app/forgot-password/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Mail, Loader2, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Поддержка редиректа типа /forgot-password?sent=1
  useEffect(() => {
    if (searchParams.get('sent') === '1') {
      setMsg('Если такой email зарегистрирован — мы отправили ссылку для сброса пароля.');
    }
    if (searchParams.get('error')) {
      setErr('Не удалось отправить письмо. Попробуйте позже.');
    }
  }, [searchParams]);

  const emailInvalid = useMemo(() => {
    if (!email) return true;
    // базовая валидация email
    return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }, [email]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || emailInvalid) return;

    setLoading(true);
    setMsg(null);
    setErr(null);

    try {
      const res = await fetch('/api/auth/password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });

      // Спокойная одинаковая реакция вне зависимости от того, есть ли такой email
      await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr('Не удалось отправить письмо. Попробуйте позже.');
      } else {
        setMsg('Если такой email зарегистрирован — мы отправили ссылку для сброса пароля.');
      }
    } catch {
      setErr('Сеть недоступна. Проверьте подключение и попробуйте снова.');
    } finally {
      setLoading(false);
    }
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
        {/* Card with gradient border ring */}
        <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-indigo-500/40 via-purple-500/30 to-indigo-500/20 shadow-2xl shadow-indigo-500/10">
          {/* Декоративная картинка как на логин-странице */}
          <img
            src="/assets/mangalogin.png"
            alt=""
            aria-hidden="true"
            className="
              pointer-events-none absolute z-20 select-none drop-shadow-md
              h-[210px]
              left-[250px]
              -top-[620px]
              sm:-top-[240px]
              md:-top-[260px]
              lg:-top-[160px]
            "
            decoding="async"
            fetchPriority="high"
          />

          <div className="relative z-10 rounded-2xl bg-white/70 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200/60 dark:border-zinc-800/60 p-6 sm:p-8 pt-16">
            {/* Header */}
            <div className="mb-6 text-center">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Сброс пароля</h1>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Укажите email — мы пришлём ссылку для смены пароля.
              </p>
            </div>

            {/* Alerts */}
            {msg && (
              <div
                role="status"
                aria-live="polite"
                className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400"
              >
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>{msg}</span>
              </div>
            )}
            {err && (
              <div
                role="alert"
                aria-live="assertive"
                className="mb-4 flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-400"
              >
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>{err}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={submit} className="space-y-4" noValidate>
              <div>
                <label className="mb-1 block text-sm font-medium">E-mail</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Mail className="h-4 w-4 text-zinc-400" />
                  </div>
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white/80 dark:bg-zinc-800/80 px-10 py-2.5 text-[15px] shadow-sm placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    aria-invalid={emailInvalid ? 'true' : 'false'}
                  />
                </div>
                {/* Микро-подсказка об ошибке */}
                {email && emailInvalid && (
                  <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">Введите корректный email</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || emailInvalid}
                className={`group relative w-full overflow-hidden rounded-xl py-3 text-white transition focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
                  loading || emailInvalid
                    ? 'bg-indigo-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40'
                }`}
              >
                <span className="inline-flex items-center justify-center gap-2">
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? 'Отправляем…' : 'Отправить ссылку'}
                </span>
              </button>
            </form>

            {/* Links */}
            <div className="mt-6 flex items-center justify-between text-sm">
              <Link href="/login" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                Вернуться ко входу
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

        {/* Tiny legal footnote */}
        <p className="mt-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
          Если письма нет, проверьте «Спам» и корректность адреса.
        </p>
      </div>
    </div>
  );
}
