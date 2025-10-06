'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import AddRelatedButton from '@/components/AddRelatedButton';
import { useTheme } from '@/lib/theme/context';
import { useAuth } from '@/components/auth/AuthProvider';

type Item =
  | { id: string; type: 'manga'; relation: string | null; target_id: number; title: string; cover_url?: string | null; url: string; kind: 'manga' }
  | { id: string; type: 'link';  relation: string | null; target_id: null;    title: string; cover_url?: string | null; url: string; kind: 'anime' | 'external' };

export default function RelatedTitlesRow({ mangaId, className = '' }: { mangaId: number; className?: string }) {
  const { theme } = useTheme();
  const { user } = useAuth();              // profile тут нет
  const [items, setItems] = useState<Item[] | null>(null);

  const didLoadRef = useRef(false);

  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;

    const ac = new AbortController();
    (async () => {
      try {
        const r = await fetch(`/api/manga/${mangaId}/relations`, { cache: 'no-store', signal: ac.signal });
        const j = await r.json().catch(() => ({}));
        setItems(Array.isArray(j?.items) ? j.items : []);
      } catch {
        if (!ac.signal.aborted) setItems([]);
      }
    })();

    return () => ac.abort();
  }, [mangaId]);

  const canAdd = ['admin', 'moderator'].includes(String((user as any)?.role || '').toLowerCase());

  const card  = theme === 'light' ? 'bg-white border-gray-200' : 'bg-slate-900 border-white/10';
  const title = theme === 'light' ? 'text-gray-900' : 'text-white';
  const muted = theme === 'light' ? 'text-gray-500' : 'text-gray-400';

  return (
    <section className={className}>
      <div className="flex items-center justify-between mb-2">
        <h3 className={`text-lg font-semibold ${title}`}>Связанное</h3>
        {canAdd && <AddRelatedButton mangaId={mangaId} compact />}
      </div>

      {items === null ? (
        <div className={`${muted} text-sm`}>Загрузка…</div>
      ) : items.length === 0 ? (
        <div className={`${muted} text-sm`}>Пока ничего не добавлено</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {items.map((it) => {
            const badge =
              it.relation === 'adaptation' ? 'Адаптация'
              : it.relation === 'sequel' ? 'Сиквел'
              : it.relation === 'prequel' ? 'Приквел'
              : it.relation === 'spin-off' ? 'Спин-офф'
              : it.relation === 'alt' ? 'Альтернативная'
              : 'Связано';

            const isExternal = it.type === 'link';
            const tag = it.type === 'link' && it.kind === 'anime' ? 'аниме'
                    : it.type === 'link' ? 'ссылка' : 'манга';

            const body = (
              <div className={`rounded-xl border ${card} overflow-hidden hover:-translate-y-0.5 transition-transform`}>
                <div className="relative w-full aspect-[3/4] bg-black/5">
                  <Image
                    src={it.cover_url || '/cover-placeholder.png'}
                    alt={it.title}
                    fill
                    className="object-cover"
                    sizes="200px"
                  />
                  <div className="absolute left-2 top-2 text-[11px] px-2 py-0.5 rounded-full bg-black/60 text-white">
                    {badge}
                  </div>
                </div>
                <div className="p-2">
                  <div className="text-sm font-medium line-clamp-2">{it.title}</div>
                  <div className={`text-[11px] mt-0.5 uppercase ${muted}`}>{tag}</div>
                </div>
              </div>
            );

            return isExternal
              ? (<a key={it.id} href={it.url} target="_blank" rel="noopener noreferrer">{body}</a>)
              : (<Link key={it.id} href={it.url}>{body}</Link>);
          })}
        </div>
      )}
    </section>
  );
}
