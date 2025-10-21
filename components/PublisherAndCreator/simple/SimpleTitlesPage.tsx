'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/Header';

/* ===== helpers ===== */
async function tryJson(urls: string | string[]) {
  const list = Array.isArray(urls) ? urls : [urls];
  for (const u of list) {
    try {
      const r = await fetch(u, { cache: 'no-store' });
      const t = await r.text();
      if (!t) continue;
      const j = JSON.parse(t);
      if (r.ok && j) return j;
    } catch {}
  }
  return null;
}

type EntityType = 'creator' | 'publisher';
type RoleKey = 'author' | 'artist' | 'publisher';

type EntityLite = {
  id: string;
  handle: string;
  name: string;
  avatar_url: string | null;
  entityType: EntityType;
};

type TitleLink = {
  id: number;
  slug: string | null;
  title: string;
  cover_url: string | null;
  roles: RoleKey[];
  year: number | null;
};

function normalizeEntity(raw: any, entityType: EntityType, handle: string): EntityLite | null {
  if (!raw?.ok || !raw?.data) return null;
  const node = raw.data[entityType] ?? raw.data.creator ?? raw.data.publisher;
  if (!node?.id) return null;
  return {
    id: String(node.id),
    handle: node.handle || node.slug || handle,
    name: node.name || node.full_name || handle,
    avatar_url: node.avatar_url ?? node.logo_url ?? node.photo_url ?? node.image_url ?? null,
    entityType,
  };
}

function normalizeTitles(raw: any): TitleLink[] {
  const arr = raw?.data?.titles ?? raw?.data ?? raw ?? [];
  if (!Array.isArray(arr)) return [];
  return arr.map((t: any) => {
    const rolesArr = Array.isArray(t.roles) ? t.roles : (t.role ? [t.role] : []);
    const roles = rolesArr
      .map((r: any) => String(r).toLowerCase())
      .filter((r: string) => r === 'author' || r === 'artist' || r === 'publisher') as RoleKey[];
    return {
      id: Number(t.id ?? t.manga_id ?? 0),
      slug: t.slug ?? t.romaji_slug ?? null,
      title: t.title ?? t.name ?? 'Без названия',
      cover_url: t.cover_url ?? t.poster_url ?? null,
      roles,
      year: t.year ?? t.start_year ?? null,
    };
  });
}

const ROLE_LABEL: Record<RoleKey, string> = {
  author: 'Автор',
  artist: 'Художник',
  publisher: 'Издатель',
};

function Cover({ src, alt }: { src: string | null; alt: string }) {
  const s = src && src.trim() ? src : '/cover-placeholder.png';
  return <img src={s} alt={alt} className="block w-full h-full object-cover" loading="lazy" />;
}

function Avatar({ src, alt }: { src: string | null; alt: string }) {
  if (src && src.trim()) {
    return <img src={src} alt={alt} className="block w-full h-full object-cover" loading="lazy" />;
  }
  const letter = (alt || '?').trim().charAt(0).toUpperCase();
  return (
    <div className="w-full h-full grid place-items-center bg-muted text-muted-foreground select-none">
      <span className="text-5xl font-extrabold">{letter}</span>
    </div>
  );
}

/* ===== Page ===== */
export default function SimpleTitlesPage({ entityType }: { entityType: EntityType }) {
  const params = useParams<{ handle: string }>();
  // !!! важно: снимаем двойное кодирование
  const handle = decodeURIComponent(String(params?.handle ?? ''));

  const [entity, setEntity] = useState<EntityLite | null>(null);
  const [titles, setTitles] = useState<TitleLink[]>([]);
  const [roleFilter, setRoleFilter] = useState<RoleKey | 'all'>('all');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!handle) return;
      setLoading(true);
      setNotFound(false);

      // 1) загружаем сущность. handle кодируем ровно ОДИН раз.
      const eRaw = await tryJson(
        entityType === 'creator'
          ? [
              `/api/people/${encodeURIComponent(handle)}`,
              `/api/creator/${encodeURIComponent(handle)}`,
            ]
          : [
              `/api/publisher/${encodeURIComponent(handle)}`,
              `/api/publishers/${encodeURIComponent(handle)}`,
            ],
      );
      const e = normalizeEntity(eRaw, entityType, handle);
      if (!e) {
        if (alive) { setNotFound(true); setLoading(false); }
        return;
      }
      if (alive) setEntity(e);

      // 2) тайтлы по ID
      const tRaw = await tryJson(
        entityType === 'creator'
          ? [ `/api/people/${encodeURIComponent(e.id)}/titles` ]
          : [ `/api/publisher/${encodeURIComponent(e.id)}/titles` ],
      );
      const ts = normalizeTitles(tRaw);
      if (alive) setTitles(ts);

      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [handle, entityType]);

  const visible = useMemo(() => {
    let list = titles;
    if (roleFilter !== 'all') {
      list = list.filter(t => (t.roles ?? []).includes(roleFilter));
    }
    if (q.trim()) {
      const qq = q.toLowerCase();
      list = list.filter(t => (t.title || '').toLowerCase().includes(qq));
    }
    return list;
  }, [titles, roleFilter, q]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <div className="max-w-[1200px] mx-auto px-6 py-10">
          <div className="text-sm text-muted-foreground">Загрузка…</div>
        </div>
      </div>
    );
  }

  if (notFound || !entity) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <div className="px-6 py-16">
          <div className="max-w-[900px] mx-auto text-center">
            <h1 className="text-2xl font-bold mb-2">Страница не найдена</h1>
            <p className="text-muted-foreground">
              {entityType === 'creator' ? 'Создатель' : 'Издатель'} @{handle} не найден.
            </p>
            <Link href="/" className="inline-block mt-6 rounded-xl bg-muted px-4 py-2 border border-border hover:opacity-90">
              На главную
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const roleTabs: RoleKey[] =
    entityType === 'creator'
      ? (['author', 'artist'] as RoleKey[])
      : (['publisher'] as RoleKey[]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <div className="mx-auto max-w-[1400px] px-6 py-6">
        {/* Шапка: окно для аватарки слева + инфо справа */}
        <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[180px_1fr] gap-6 items-start mb-6">
          <div className="sticky top-24">
            {/* Высокое окно под аватарку (как на скриншоте) */}
            <div className="w-[140px] sm:w-[180px] h-[220px] sm:h-[260px] rounded-2xl overflow-hidden border border-border bg-card shadow-sm">
              <Avatar src={entity.avatar_url} alt={entity.name} />
            </div>
          </div>

          <div className="min-w-0">
            <h1 className="text-2xl font-bold leading-tight">{entity.name}</h1>
            <div className="mt-1 text-sm text-muted-foreground">
              {entityType === 'creator' ? 'Люди' : 'Издатель'} · {titles.length} тайтл(ов)
            </div>

            {/* Поиск + фильтр по роли */}
            <div className="mt-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Поиск по названию…"
                className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRoleFilter('all')}
                  className={`px-3 py-2 rounded-md border text-sm ${roleFilter==='all' ? 'bg-muted border-border' : 'border-transparent hover:bg-muted'}`}
                >
                  Все
                </button>
                {roleTabs.map(r => (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    className={`px-3 py-2 rounded-md border text-sm ${roleFilter===r ? 'bg-muted border-border' : 'border-transparent hover:bg-muted'}`}
                  >
                    {ROLE_LABEL[r]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Сетка карточек */}
        {visible.length === 0 ? (
          <div className="text-sm text-muted-foreground">Ничего не найдено.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {visible.map((t) => (
              <Link
                key={`${t.id}-${t.slug ?? 'noslug'}`}
                href={`/title/${t.slug ?? t.id}`}
                className="group block rounded-lg overflow-hidden border border-border bg-card hover:shadow-md transition-shadow"
              >
                <div className="aspect-[2/3] w-full overflow-hidden bg-muted">
                  <Cover src={t.cover_url} alt={t.title} />
                </div>
                <div className="p-2">
                  <div className="text-sm font-medium leading-tight line-clamp-2 group-hover:underline">
                    {t.title}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                    {(t.roles ?? []).map((r) => (
                      <span
                        key={r}
                        className="inline-flex items-center rounded-full border border-border px-2 py-0.5"
                      >
                        {ROLE_LABEL[r as RoleKey] ?? r}
                      </span>
                    ))}
                    {t.year ? <span className="ml-auto">{t.year}</span> : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
