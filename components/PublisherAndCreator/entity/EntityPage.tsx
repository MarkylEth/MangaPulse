// components/entity/EntityPage.tsx
'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { tryJson } from '@/lib/utils';
import { useTheme } from '@/lib/theme/context';
import type { EntityLite, TitleLink, RoleKey } from './types';
import EntityBanner from './parts/EntityBanner';
import EntityStats from './parts/EntityStats';
import EntityTabs from './parts/EntityTabs';

const LOADING_GIF_SRC = '/images/profile-loading.gif';

function normalizeEntity(raw: any, entityType: 'creator'|'publisher', fallbackHandle: string): EntityLite | null {
  // ожидаем { ok, data: { creator | publisher } }
  if (!raw?.ok || !raw?.data) return null;
  const node = raw.data[entityType];
  if (!node?.id) return null;

  // унификация
  return {
    id: String(node.id),
    handle: node.handle || node.slug || fallbackHandle,
    name: node.name || node.full_name || node.title || fallbackHandle,
    avatar_url: node.avatar_url ?? node.logo_url ?? null,
    banner_url: node.banner_url ?? null,
    bio: node.bio ?? node.description ?? null,
    socials: {
      x_url: node.x_url ?? null,
      telegram: node.telegram ?? null,
      vk_url: node.vk_url ?? null,
      site_url: node.site_url ?? node.website ?? null,
    },
    created_at: node.created_at ?? null,
    roles: Array.isArray(node.roles) ? node.roles : null,
    entityType,
  };
}

function normalizeTitles(raw: any): TitleLink[] {
  const arr = raw?.data?.titles ?? raw?.data ?? raw ?? [];
  if (!Array.isArray(arr)) return [];
  return arr.map((t: any) => ({
    id: Number(t.id ?? t.manga_id ?? 0),
    slug: t.slug ?? t.romaji_slug ?? null,
    title: t.title ?? t.name ?? 'Без названия',
    cover_url: t.cover_url ?? t.poster_url ?? null,
    roles: Array.isArray(t.roles) ? t.roles
          : (t.role ? [t.role] : []),
    year: t.year ?? t.start_year ?? null,
  }));
}

export default function EntityPage({ entityType }: { entityType: 'creator'|'publisher' }) {
  const { handle } = useParams<{ handle: string }>();
  const { theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [entity, setEntity] = useState<EntityLite | null>(null);
  const [titles, setTitles] = useState<TitleLink[]>([]);
  const [error, setError] = useState<string | null>(null);

  // динамические вкладки из ролей в данных по тайтлам
  const roleKeys: RoleKey[] = useMemo(() => {
    const pool = new Set<RoleKey>();
    titles.forEach(t => (t.roles ?? []).forEach((r: string) => pool.add(r as RoleKey)));
    // дефолтные роль-вкладки
    if (entityType === 'creator') {
      // нормируем названия
      if (pool.size === 0) ['author','artist'].forEach(r => pool.add(r as RoleKey));
    }
    if (entityType === 'publisher') {
      if (pool.size === 0) ['publisher'].forEach(r => pool.add(r as RoleKey));
    }
    return Array.from(pool.values());
  }, [titles, entityType]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!handle) return;
      setLoading(true);
      setError(null);

      try {
        // 1) получаем сущность (creator | publisher)
        const base = entityType;
        const byHandleCandidates =
          base === 'creator'
            ? [
                `/api/creator/by-handle?u=${encodeURIComponent(String(handle))}`,
                `/api/authors/by-handle?u=${encodeURIComponent(String(handle))}`,
                `/api/people/by-handle?u=${encodeURIComponent(String(handle))}`,
              ]
            : [
                `/api/publisher/by-handle?u=${encodeURIComponent(String(handle))}`,
                `/api/publishers/by-handle?u=${encodeURIComponent(String(handle))}`,
              ];

        const eRaw = await tryJson(byHandleCandidates);
        const e = normalizeEntity(eRaw, entityType, String(handle));
        if (!e?.id) {
          if (alive) {
            setEntity(null);
            setTitles([]);
            setError('not_found');
            setLoading(false);
          }
          return;
        }
        if (alive) setEntity(e);

        // 2) тайтлы, связанные с сущностью
        const titlesCandidates =
          entityType === 'creator'
            ? [
                `/api/creator/${encodeURIComponent(e.id)}/titles`,
                `/api/people/${encodeURIComponent(e.id)}/titles`,
                `/api/author/${encodeURIComponent(e.id)}/manga`, // legacy
              ]
            : [
                `/api/publisher/${encodeURIComponent(e.id)}/titles`,
                `/api/publishers/${encodeURIComponent(e.id)}/titles`,
              ];

        const tRaw = await tryJson(titlesCandidates);
        const ts = normalizeTitles(tRaw);
        if (alive) setTitles(ts);
      } catch (err) {
        console.error('[EntityPage] load failed', err);
        if (alive) {
          setEntity(null);
          setTitles([]);
          setError('load_failed');
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [handle, entityType]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground relative">
        <div className="fixed inset-0 pointer-events-none opacity-20">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-foreground/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-foreground/5 rounded-full blur-3xl" />
        </div>
        <Header showSearch={false} />
        <div className="relative max-w-[1400px] mx-auto px-6 py-12">
          <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
            <div className="rounded-2xl overflow-hidden ring-1 ring-border/40 shadow-lg">
              <img src={LOADING_GIF_SRC} alt="Загрузка…" className="block w-36 h-36 md:w-52 md:h-52 object-cover select-none" />
            </div>
            <p className="text-muted-foreground">Загрузка…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!entity || error === 'not_found') {
    return (
      <div className="min-h-screen bg-background text-foreground relative">
        <div className="fixed inset-0 pointer-events-none opacity-20">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-foreground/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-foreground/5 rounded-full blur-3xl" />
        </div>
        <Header showSearch={false} />
        <div className="relative max-w-[1400px] mx-auto px-6 py-16">
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🤷‍♂️</div>
            <h1 className="text-2xl font-bold mb-2">Страница не найдена</h1>
            <p className="text-muted-foreground mb-6">
              Сущность @{handle} не существует или была удалена
            </p>
            <a href="/" className="inline-block px-6 py-3 rounded-xl bg-muted border border-border hover:opacity-90 transition-colors">
              На главную
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-foreground/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-foreground/5 rounded-full blur-3xl" />
      </div>

      <Header showSearch={false} />

      <div className="relative mx-auto max-w-[1400px] px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left / main */}
          <div className="lg:col-span-8 space-y-6">
            <EntityBanner entity={entity} />
            {entity.bio && (
              <section className="rounded-2xl p-6 bg-card/80 backdrop-blur-sm border border-border/50">
                <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
                  О {entity.entityType === 'creator' ? 'создателе' : 'издателе'}
                </h2>
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                  {entity.bio}
                </p>
              </section>
            )}

            <EntityTabs
              theme={theme === 'light' ? 'light' : 'dark'}
              entityType={entity.entityType}
              titles={titles}
              roleKeys={roleKeys}
            />
          </div>

          {/* Right / sidebar */}
          <aside className="lg:col-span-4">
            <EntityStats entity={entity} titles={titles} roleKeys={roleKeys} />
          </aside>
        </div>
      </div>
    </div>
  );
}
