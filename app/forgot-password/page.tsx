// app/forgot-password/page.tsx (минималка)
'use client';

import { useState } from 'react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/auth/password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      await res.json();
      setMsg('Если такой email зарегистрирован — мы отправили ссылку для сброса пароля.');
    } catch {
      setMsg('Что-то пошло не так. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Сброс пароля</h1>
      <p className="text-sm text-gray-500 mb-4">Укажите email, мы пришлём ссылку для сброса.</p>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="email"
          placeholder="you@example.com"
          className="w-full rounded-md border px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button
          type="submit"
          className="rounded-md bg-blue-600 text-white px-4 py-2 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Отправляем…' : 'Отправить ссылку'}
        </button>
        {msg && <div className="text-sm text-gray-700">{msg}</div>}
      </form>
    </div>
  );
}
