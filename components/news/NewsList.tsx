// components/news/NewsList.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { MessageSquare, Clock, Pin } from 'lucide-react';
import { AvatarImg, RoleBadge, safeDateLabel, stripHtmlToText, type Role } from './parts';

const LOADING_GIF_SRC = '/images/profile-loading.gif';

type NewsItem = {
  id: number;
  title: string;
  body: string;
  pinned: boolean;
  visible: boolean;
  created_at: string;
  author_id: string;
  author_name: string | null;
  author_avatar: string | null;
  author_role: Role;
  comment_count?: number;
};

export default function NewsList() {
  const STEP = 12;
  const [limit, setLimit] = React.useState(STEP);
  const [items, setItems] = React.useState<NewsItem[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadNews = React.useCallback(async (lmt: number) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/news?limit=${lmt}`, { cache: 'no-store', credentials: 'include' });
      if (!r.ok) throw new Error('failed');
      const j = await r.json();
      const arr: NewsItem[] = Array.isArray(j?.data) ? j.data : [];
      setItems(arr);
    } catch {
      setError('Не удалось загрузить список новостей');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { loadNews(limit); }, [limit, loadNews]);

  const hasMore = (items?.length ?? 0) >= limit;

  if (loading && !items) {
    return (
      <div className="min-h-screen bg-[rgb(var(--background))] text-[rgb(var(--foreground))]">
        <Header showSearch={false} />
        <main className="relative max-w-[1400px] mx-auto px-6 py-12">
          <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
            <div className="rounded-2xl overflow-hidden ring-1 ring-border/40 shadow-lg">
              <img src={LOADING_GIF_SRC} alt="Загрузка…" className="block w-36 h-36 md:w-52 md:h-52 object-cover select-none"
                   onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            </div>
            <p className="text-muted-foreground">Загрузка новостей…</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--background))] text-[rgb(var(--foreground))]">
      <Header showSearch={false} />

      <main className="px-4 sm:px-6 py-6 max-w-4xl mx-auto">
        <div className="mb-6 flex items-center gap-2">
          <MessageSquare className="w-6 h-6" />
          <h1 className="text-2xl sm:text-3xl font-bold">Новости</h1>
        </div>

        <section className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] overflow-hidden shadow-sm">
          {error && <div className="p-6 text-sm text-red-500">{error}</div>}

          {items && items.length > 0 && (
            <ul className="divide-y divide-[rgb(var(--border))]">
              {items.map((n) => (
                <li key={n.id} className="p-6 hover:bg-[rgb(var(--muted))]/30 transition-colors">
                  <article className="flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm">
                        <AvatarImg src={n.author_avatar} size={28} />
                        <span className="font-medium text-[rgb(var(--foreground))]">
                          {n.author_name || 'Пользователь'}
                        </span>
                        <RoleBadge role={n.author_role} />
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs text-[rgb(var(--muted-foreground))]">
                        <Clock className="w-3.5 h-3.5" />
                        {safeDateLabel(n.created_at)}
                      </span>
                    </div>

                    {n.pinned && (
                      <div>
                        <span className="inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-md bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))] border border-[rgb(var(--border))]">
                          <Pin className="w-3 h-3" />
                          Закреплено
                        </span>
                      </div>
                    )}

                    <Link href={`/news/${n.id}`} className="text-lg sm:text-xl font-semibold leading-snug hover:underline underline-offset-2 decoration-2">
                      {n.title}
                    </Link>

                    <p className="text-[15px] leading-relaxed text-[rgb(var(--muted-foreground))] whitespace-pre-wrap">
                      {stripHtmlToText(n.body, 240)}
                    </p>

                    <div className="flex items-center gap-3">
                      <Link
                        href={`/news/${n.id}`}
                        className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium
                                   border border-black/10 dark:border-white/10
                                   bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10
                                   text-gray-800 dark:text-gray-200 transition-all"
                      >
                        Читать полностью
                      </Link>

                      {n.comment_count != null && n.comment_count > 0 && (
                        <div className="inline-flex items-center gap-1.5 text-sm text-[rgb(var(--muted-foreground))]">
                          <MessageSquare className="w-4 h-4" />
                          <span>{n.comment_count}</span>
                        </div>
                      )}
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}

          {items && items.length === 0 && !loading && (
            <div className="px-6 py-12 text-center text-[rgb(var(--muted-foreground))]">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">Пока нет новостей</p>
            </div>
          )}

          {items && items.length > 0 && hasMore && (
            <div className="flex justify-center p-6 pt-3">
              <button
                onClick={() => setLimit((n) => n + STEP)}
                className="inline-flex items-center gap-1 rounded-xl px-5 py-2.5 text-sm font-medium
                           border border-black/10 dark:border-white/10
                           bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10
                           text-gray-800 dark:text-gray-200 transition-all"
              >
                Загрузить ещё
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
