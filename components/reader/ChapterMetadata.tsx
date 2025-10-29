// components/reader/ChapterMetadata.tsx
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, Bookmark, BookmarkCheck } from 'lucide-react';
import type { TeamInfo } from '@/lib/reader/types';

interface ChapterMetadataProps {
  chapterTeams: TeamInfo[];
  chapterId: number;
  mangaId: number;
  currentPage: number;
  userId: string | null;
}

export default function ChapterMetadata({
  chapterTeams,
  chapterId,
  mangaId,
  currentPage,
  userId,
}: ChapterMetadataProps) {
  // Likes
  const [likes, setLikes] = useState<number | null>(null);
  const [liked, setLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);

  // Bookmark
  const [bmHas, setBmHas] = useState(false);
  const [bmPage, setBmPage] = useState<number | null>(null);
  const [bmBusy, setBmBusy] = useState(false);

  // Load likes
  useEffect(() => {
    if (!chapterId) return;
    let cancel = false;

    (async () => {
      try {
        const q = userId ? `?user=${encodeURIComponent(userId)}` : '';
        const r = await fetch(`/api/chapters/${chapterId}/metrics${q}`, { cache: 'no-store' });
        const j = await r.json().catch(() => ({}));
        
        if (!cancel) {
          setLikes(Number(j?.likes ?? 0));
          setLiked(Boolean(j?.likedByMe));
        }
      } catch {}
    })();

    return () => { cancel = true; };
  }, [chapterId, userId]);

  // Load bookmark
  useEffect(() => {
    if (!chapterId || !userId) {
      setBmHas(false);
      setBmPage(null);
      return;
    }

    let cancel = false;

    (async () => {
      try {
        const r = await fetch(`/api/reader/bookmarks?chapter_id=${chapterId}`, {
          cache: 'no-store',
          credentials: 'include',
        });
        const j = r.ok ? await r.json() : null;
        
        if (!cancel) {
          setBmHas(!!j?.has);
          setBmPage(j?.page ?? null);
        }
      } catch {
        if (!cancel) {
          setBmHas(false);
          setBmPage(null);
        }
      }
    })();

    return () => { cancel = true; };
  }, [userId, chapterId]);

  const toggleLike = useCallback(async () => {
    if (!userId) {
      alert('Войдите, чтобы лайкать');
      return;
    }
    if (likeBusy) return;

    setLikeBusy(true);
    try {
      const method = liked ? 'DELETE' : 'POST';
      const r = await fetch(`/api/chapters/${chapterId}/vote`, {
        method,
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      const j = await r.json().catch(() => ({}));
      
      if (!r.ok || !j?.ok) throw new Error(j?.error || 'fail');

      const newLikes = typeof j?.likes === 'number'
        ? Number(j.likes)
        : Math.max(0, (likes ?? 0) + (liked ? -1 : 1));
      const newLiked = typeof j?.likedByMe === 'boolean' ? Boolean(j.likedByMe) : !liked;

      setLikes(newLikes);
      setLiked(newLiked);
    } catch (e: any) {
      alert(e?.message || 'Ошибка');
    } finally {
      setLikeBusy(false);
    }
  }, [userId, chapterId, liked, likes, likeBusy]);

  const toggleBookmark = useCallback(async () => {
    if (!userId) {
      alert('Войдите, чтобы ставить закладки');
      return;
    }
    if (bmBusy) return;

    setBmBusy(true);
    try {
      if (bmHas && bmPage === currentPage) {
        await fetch('/api/reader/bookmarks', {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chapter_id: chapterId }),
        });
        setBmHas(false);
        setBmPage(null);
      } else {
        await fetch('/api/reader/bookmarks', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ manga_id: mangaId, chapter_id: chapterId, page: currentPage }),
        });
        setBmHas(true);
        setBmPage(currentPage);
      }
    } finally {
      setBmBusy(false);
    }
  }, [userId, chapterId, mangaId, currentPage, bmHas, bmPage, bmBusy]);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
      {/* Teams */}
      <div className="flex-1">
        {chapterTeams.length >= 1 ? (
          <div className="flex flex-wrap items-center gap-2">
            {chapterTeams.map((t, idx) => (
              <Link
                key={t.id ?? `${t.slug}-${idx}`}
                href={`/team/${t.slug ?? t.id}`}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 bg-white/5 border-white/10"
                title={t.name ?? 'Команда перевода'}
              >
                {t.avatar_url ? (
                  <img src={t.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-white/10" />
                )}
                <span className="text-sm text-white">{t.name ?? 'Команда'}</span>
                {t.verified && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/80">
                    ✔
                  </span>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm bg-white/5 border-white/10 text-white">
            <div className="h-6 w-6 rounded-full bg-white/10" />
            Перевод: неизвестно
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Like */}
        <button
          onClick={toggleLike}
          disabled={likeBusy}
          className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[#e5e7eb] border-white/20 bg-transparent hover:bg-white/10 transition"
          title={liked ? 'Убрать лайк' : 'Поставить лайк'}
        >
          <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
          <span className="font-semibold tabular-nums">{likes === null ? '…' : likes}</span>
          <span className="text-sm opacity-70">лайков</span>
        </button>

        {/* Bookmark */}
        <button
          onClick={toggleBookmark}
          disabled={bmBusy || !userId || !chapterId}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-white hover:bg-white/10 ${
            bmHas ? 'bg-white/20 border-white/20' : 'bg-white/5 border-white/10'
          }`}
          title={
            bmHas
              ? bmPage
                ? `Закладка: стр. ${bmPage}`
                : 'Закладка установлена'
              : 'Поставить закладку на текущую страницу'
          }
        >
          {bmHas ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}