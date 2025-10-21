// app/reset-password/page.tsx
'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState } from 'react';

export default function ResetPasswordPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const token = sp.get('token') ?? '';
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd !== pwd2) return setMsg('Пароли не совпадают');
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: pwd }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Ошибка');
      setMsg('Пароль обновлён. Сейчас вернёмся на главную…');
      setTimeout(() => router.push('/?reset=1'), 800);
    } catch (err: any) {
      setMsg(`Ошибка: ${err?.message ?? 'неизвестно'}`);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return <div className="p-6">Неверная ссылка (нет токена).</div>;
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Новый пароль</h1>
      <p className="text-sm text-gray-500 mb-4">Введите новый пароль для вашего аккаунта.</p>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          type="password"
          placeholder="Новый пароль"
          className="w-full rounded-md border px-3 py-2"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          minLength={6}
          required
        />
        <input
          type="password"
          placeholder="Повторите пароль"
          className="w-full rounded-md border px-3 py-2"
          value={pwd2}
          onChange={(e) => setPwd2(e.target.value)}
          minLength={6}
          required
        />
        <button
          type="submit"
          className="rounded-md bg-blue-600 text-white px-4 py-2 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Обновляем…' : 'Сохранить пароль'}
        </button>
        {msg && <div className="text-sm text-gray-700">{msg}</div>}
      </form>
    </div>
  );
}
