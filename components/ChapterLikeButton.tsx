'use client';

import React from 'react';
import { Heart } from 'lucide-react';

type Props = { chapterId: number; className?: string };

export default function ChapterLikeButton({ chapterId, className = '' }: Props) {
  const [likes, setLikes] = React.useState<number | null>(null);
  const [liked, setLiked] = React.useState<boolean>(false);
  const [me, setMe] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [hint, setHint] = React.useState<string | null>(null);

  // узнаём user_id
  React.useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' });
        const j = r.ok ? await r.json() : null;
        const id = j?.userId ?? j?.user_id ?? j?.id ?? j?.user?.id ?? null;
        setMe(id ? String(id) : null);
      } catch { setMe(null); }
    })();
  }, []);

  // грузим метрики (без слова like в URL)
  React.useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const q = me ? `?user=${encodeURIComponent(me)}` : '';
        const r = await fetch(`/api/chapters/${chapterId}/metrics${q}`, { cache: 'no-store', signal: ac.signal });
        const j = await r.json().catch(() => ({}));
        if (!ac.signal.aborted) {
          setLikes(Number(j?.likes ?? 0));
          setLiked(Boolean(j?.likedByMe));
        }
      } catch {
        if (!ac.signal.aborted) { setLikes(0); setLiked(false); }
      }
    })();
    return () => ac.abort();
  }, [chapterId, me]);

  async function doToggle() {
    if (!me) { setHint('Войдите, чтобы лайкать'); setTimeout(() => setHint(null), 1500); return; }
    if (busy) return;
    setBusy(true);
    try {
      const method = liked ? 'DELETE' : 'POST';
      const r = await fetch(`/api/chapters/${chapterId}/vote`, {
        method,
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user_id: me }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || 'fail');
      setLikes(Number(j?.likes ?? 0));
      setLiked(Boolean(j?.likedByMe));
    } catch (e: any) {
      setHint(e?.message || 'Ошибка'); setTimeout(() => setHint(null), 1500);
    } finally { setBusy(false); }
  }

  const btnClass =
    'relative inline-flex items-center gap-2 rounded-full px-4 py-1.5 ' +
    'text-[#e5e7eb] border border-white/20 bg-transparent hover:bg-white/10 ' +
    'transition focus:outline-none focus-visible:ring-2 ring-white/20';

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); void doToggle(); }}
        className={btnClass}
        style={{ filter: 'none', mixBlendMode: 'normal' }}
        aria-pressed={liked}
        disabled={busy}
        title={liked ? 'Убрать лайк' : 'Поставить лайк'}
      >
        <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
        <span className="font-semibold tabular-nums">{likes === null ? '…' : likes}</span>
        <span className="text-sm opacity-70">лайков</span>

        {hint && (
          <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap
                           rounded-md px-2 py-1 text-xs bg-[#1f2937] text-white border border-white/10 shadow">
            {hint}
          </span>
        )}
      </button>
    </div>
  );
}
