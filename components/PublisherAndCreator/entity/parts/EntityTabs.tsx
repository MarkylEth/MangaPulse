// components/entity/parts/EntityTabs.tsx
'use client';

import { useMemo, useState } from 'react';
import type { TitleLink, RoleKey } from '../types';
import Link from 'next/link';

export default function EntityTabs({
  theme,
  entityType,
  titles,
  roleKeys,
}: {
  theme: 'light' | 'dark';
  entityType: 'creator' | 'publisher';
  titles: TitleLink[];
  roleKeys: RoleKey[];
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<RoleKey | 'all'>('all');
  const [sort, setSort] = useState<'az' | 'year_desc' | 'year_asc'>('az');

  const tabs = useMemo(() => ([
    { key: 'all' as const, label: 'Все' },
    ...roleKeys.map(r => ({ key: r, label: roleLabel(r) })),
  ]), [roleKeys]);

  const filtered = useMemo(() => {
    let list = titles.slice();

    if (active !== 'all') {
      list = list.filter(t => (t.roles ?? []).includes(active));
    }

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(t => t.title.toLowerCase().includes(q));
    }

    switch (sort) {
      case 'az':
        list.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'year_desc':
        list.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
        break;
      case 'year_asc':
        list.sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
        break;
    }

    return list;
  }, [titles, active, query, sort]);

  return (
    <section className="rounded-2xl p-4 sm:p-6 bg-card/80 border border-border/60 backdrop-blur-sm">
      {/* controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="flex flex-wrap gap-2">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={[
                'px-3 py-1.5 rounded-full text-xs border',
                active === t.key
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-background/60 border-border hover:bg-background'
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <input
            placeholder="Поиск по названию…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="px-3 py-2 rounded-xl bg-background border border-border text-sm w-52"
          />
          <select
            value={sort}
            onChange={e => setSort(e.target.value as any)}
            className="px-3 py-2 rounded-xl bg-background border border-border text-sm"
          >
            <option value="az">А–Я</option>
            <option value="year_desc">По году ↓</option>
            <option value="year_asc">По году ↑</option>
          </select>
        </div>
      </div>

      {/* grid */}
      {filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground py-10 text-center">
          Ничего не найдено
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map(t => (
            <TitleCard key={`${t.id}-${t.slug ?? ''}`} item={t} />
          ))}
        </div>
      )}
    </section>
  );
}

function TitleCard({ item }: { item: TitleLink }) {
  const href = item.slug ? `/title/${item.slug}` : `/title/${item.id}`;
  return (
    <Link
      href={href}
      className="group rounded-xl overflow-hidden border border-border/60 bg-background/60 hover:bg-background transition"
    >
      <div className="aspect-[3/4] bg-muted overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.cover_url ?? '/images/cover-fallback.jpg'}
          alt={item.title}
          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
        />
      </div>
      <div className="p-3">
        <div className="text-sm font-medium line-clamp-2 leading-tight">{item.title}</div>
        {item.roles && item.roles.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {item.roles.slice(0, 3).map((r) => (
              <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/70 border border-border/60">
                {roleLabel(r)}
              </span>
            ))}
          </div>
        )}
        {item.year && (
          <div className="mt-1 text-xs text-muted-foreground">{item.year}</div>
        )}
      </div>
    </Link>
  );
}

function roleLabel(r: RoleKey) {
  const map: Record<string, string> = {
    author: 'Автор',
    artist: 'Художник',
    writer: 'Сценарист',
    translator: 'Переводчик',
    publisher: 'Издатель',
  };
  return map[r] ?? r;
}
