'use client';

import './globals.css';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Clock, Star } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/Header';
import HeroCarousel from '@/components/HeroCarousel';
import { useAuth } from '@/components/auth/AuthProvider';
import { useTheme } from '@/lib/theme/context';
import AuthModal from '@/components/auth/AuthModal';

/* =============== helpers =============== */
function asList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s || /^empty$/i.test(s)) return [];
    try { const parsed = JSON.parse(s); if (Array.isArray(parsed)) return asList(parsed); } catch {}
    return s.split(/[,;]\s*|\r?\n/g).map((x) => x.trim()).filter(Boolean);
  }
  return [];
}
function toNumber(v: unknown, def = 0) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function clsx(...parts: Array<string | false | null | undefined>) { return parts.filter(Boolean).join(' '); }
async function getJSON<T=any>(input: RequestInfo | URL, init: RequestInit = {}) { const r = await fetch(input, { cache: 'no-store', ...init }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<T>; }
function formatTimeAgo(iso: string): string {
  const dt = new Date(iso); const diff = Date.now() - dt.getTime(); const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec} сек назад`;
  const min = Math.floor(sec / 60); if (min < 60) return `${min} мин назад`;
  const hr = Math.floor(min / 60); if (hr < 24) return `${hr} ч назад`;
  const d = Math.floor(hr / 24); return `${d} дн назад`;
}
function safeImageSrc(input: unknown, placeholder = '/placeholder.png'): string {
  if (input == null) return placeholder; let s = String(input).trim(); if (!s) return placeholder;
  if (s.startsWith('data:')) return s; if (/^https?:\/\//i.test(s)) return s; if (s.startsWith('/')) return s;
  if (/^[a-z0-9/_\-\.]+$/i.test(s)) return '/' + s.replace(/^\/+/, ''); return placeholder;
}

/* =============== types =============== */
export type MangaApiRow = {
  id: number|string;
  title: string;
  cover_url?: string|null;
  status?: string|null;

  rating?: number|null;   // 0..5 или 0..10
  rating10?: number|null; // 0..10

  chapters?: number|null;
  chapters_count?: number|null;

  genres?: string[]|string|null;
  genres2?: string[]|string|null;

  release_year?: number|null;
  release_date?: string|null;

  // поля из вьюх "новинки"/"тренд"
  created_at?: string|null;
  manga_created_at?: string|null;
  first_chapter_at?: string|null;
  last_chapter_at?: string|null;
  last_event_at?: string|null;
  newness_at?: string|null;            // <-- ключевая дата для новинок
};

export type Manga = {
  id: number|string;
  title: string;
  cover_url?: string|null;
  status?: string|null;
  rating: number;
  chapters_count: number;
  genres?: string[];
  year: number;
  created_at_iso?: string|null;        // сохраняем ISO для отображения/страховки
};

export type ChapterFeedItem = {
  chapter_id: string|number;
  manga_id: string|number;
  manga_title: string;
  chapter_number?: string|number|null;
  volume?: string|number|null;
  created_at: string;
  cover_url?: string|null;
  team_name?: string|null;
  team_slug?: string|null;
};

/* =============== lists =============== */
const MY_LISTS = [
  { key: 'reading',   label: 'Читаю' },
  { key: 'planned',   label: 'В планах' },
  { key: 'completed', label: 'Прочитано' },
  { key: 'dropped',   label: 'Брошено' },
  { key: 'favorite',  label: 'Любимое' },
] as const;
type MyListKey = typeof MY_LISTS[number]['key'];
type MyListsMap = Record<string, MyListKey[]>;
type SectionKey = 'recs'|'new'|'trend';

/* =============== map =============== */
function mapMangaRows(rows?: MangaApiRow[]|null): Manga[] {
  if (!rows) return [];
  return rows.map((item) => {
    const rating10 =
      typeof item.rating10 === 'number'
        ? item.rating10
        : typeof item.rating === 'number'
          ? (item.rating <= 5 ? item.rating * 2 : item.rating)
          : 0;

    const genresArr = Array.isArray(item.genres)
      ? item.genres.map(String)
      : asList(item.genres ?? item.genres2 ?? null);

    // дата появления новинки: prefer newness_at
    const createdAtStr =
      (item.newness_at as any) ??
      (item.created_at as any) ??
      (item.manga_created_at as any) ??
      (item.first_chapter_at as any) ??
      (item.release_date as any) ??
      null;

    const y =
      typeof item.release_year === 'number'
        ? item.release_year
        : createdAtStr
          ? new Date(String(createdAtStr)).getFullYear()
          : new Date().getFullYear();

    return {
      id: item.id,
      title: item.title ?? 'Без названия',
      cover_url: item.cover_url ?? null,
      status: item.status ?? undefined,
      rating: toNumber(rating10, 0),
      chapters_count: toNumber(item.chapters_count ?? item.chapters, 0),
      genres: genresArr,
      year: Number.isFinite(y) ? y : new Date().getFullYear(),
      created_at_iso: createdAtStr ? String(createdAtStr) : null,
    };
  });
}

/* =============== hooks =============== */
function useMangaLazy(urls: string[]) {
  const [items, setItems] = useState<Manga[]>([]);
  const [loading, setLoading] = useState(false);
  const urlsRef = useRef(urls); urlsRef.current = urls;

  const load = useCallback(async () => {
    setLoading(true);
    for (const u of urlsRef.current) {
      try {
        const json: any = await getJSON(u);
        const rows: MangaApiRow[] = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
        setItems(mapMangaRows(rows));
        setLoading(false);
        return true;
      } catch (e) {
        console.warn('section fetch failed', u, e);
      }
    }
    setItems([]); setLoading(false); return false;
  }, []);

  return { items, loading, load };
}

/* === Лента новых глав: горизонтальная + максимум 20 === */
function useChapterFeed(initialLimit = 20) {
  const [items, setItems] = useState<ChapterFeedItem[]>([]);
  const [connected, setConnected] = useState<'sse' | 'poll' | 'none'>('none');
  const seen = useRef(new Set<string>());

  const isDebug =
    typeof window !== 'undefined' && /(^|[?&])debug=1(&|$)/.test(location.search);

  const normalize = useCallback((raw: any): ChapterFeedItem[] => {
    const src = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const out: ChapterFeedItem[] = [];

    for (const r of src) {
      if (!r) continue;

      const idRaw = r.chapter_id ?? r.id;
      if (idRaw === null || idRaw === undefined) continue;
      const id = String(idRaw).trim();
      if (!id) continue;

      const createdRaw = r.created_at ?? r.createdAt;
      if (!createdRaw) continue;
      const created = String(createdRaw);
      if (Number.isNaN(new Date(created).getTime())) continue;

      out.push({
        chapter_id: id,
        manga_id: r.manga_id ?? r.title_id ?? r.mangaId,
        manga_title: r.manga_title ?? r.mangaTitle ?? '(без названия)',
        chapter_number: r.chapter_number ?? r.number ?? null,
        volume: r.volume ?? r.vol_number ?? r.volume_number ?? null,
        created_at: created,
        cover_url: r.cover_url ?? r.coverUrl ?? null,
        team_name: r.team_name ?? r.teamName ?? null,
        team_slug: r.team_slug ?? r.teamSlug ?? null,
      });
    }

    out.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (isDebug) console.log('[feed] normalize →', out.length, out);
    return out;
  }, [isDebug]);

  const upsert = useCallback((arr: ChapterFeedItem[]) => {
    if (!arr?.length) return;
    setItems((prev) => {
      const next = [...prev];
      for (const it of arr) {
        const key = String(it.chapter_id);
        if (!seen.current.has(key)) {
          seen.current.add(key);
          next.unshift(it);
        }
      }
      next.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return next.slice(0, 20); // держим ровно 20
    });
  }, []);

  const loadInitial = useCallback(async () => {
    try {
      const json: any = await getJSON(`/api/chapters/latest?limit=${initialLimit}`);
      const rows = normalize(Array.isArray(json?.data) ? json.data : json);
      if (!rows.length && isDebug) console.warn('[feed] initial: empty payload', json);
      upsert(rows);
    } catch (e) {
      console.warn('[feed] initial load failed', e);
    }
  }, [initialLimit, normalize, upsert, isDebug]);

  useEffect(() => {
    let closed = false;
    loadInitial();
    try {
      const es = new EventSource('/api/chapters/stream');
      es.onopen = () => { setConnected('sse'); if (isDebug) console.log('[feed] SSE opened'); };
      es.onerror = () => {
        if (!closed) {
          if (isDebug) console.warn('[feed] SSE error → fallback to poll');
          setConnected('poll'); es.close();
        }
      };
      es.onmessage = (ev) => {
        try {
          const parsed = JSON.parse(ev.data);
          const rows = normalize(parsed);
          upsert(rows);
        } catch (err) {
          if (isDebug) console.warn('[feed] SSE parse error', err, ev.data);
        }
      };
      return () => { closed = true; es.close(); };
    } catch {
      setConnected('poll');
    }
  }, [normalize, upsert, loadInitial, isDebug]);

  useEffect(() => {
    if (connected !== 'poll') return;
    let t: any;
    let paused = typeof document !== 'undefined' ? document.hidden : false;

    const tick = async () => {
      try {
        const json: any = await getJSON(`/api/chapters/latest?limit=${initialLimit}`);
        const rows = normalize(Array.isArray(json?.data) ? json.data : json);
        upsert(rows);
      } catch (e) {
        if (isDebug) console.warn('[feed] poll fetch error', e);
      }
      t = setTimeout(tick, paused ? 45000 : 20000);
    };

    const onVis = () => { paused = document.hidden; };

    tick(); document.addEventListener('visibilitychange', onVis);
    return () => { clearTimeout(t); document.removeEventListener('visibilitychange', onVis); };
  }, [connected, initialLimit, normalize, upsert, isDebug]);

  return { items, connected };
}

/* =============== page =============== */
type CarouselItem = { id: number; title: string; coverUrl: string; href: string };

export default function Home() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter(); const pathname = usePathname(); const sp = useSearchParams();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login'|'register'>('login');

  // каталог (для «Моих списков» / поиска)
  const [mangaList, setMangaList] = useState<Manga[]>([]);
  const [loadingManga, setLoadingManga] = useState(true);

  const [heroItems, setHeroItems] = useState<CarouselItem[]>([]);

  const [selectedList, setSelectedList] = useState<MyListKey | null>(null);
  const [userListMap, setUserListMap] = useState<MyListsMap>({});

  // секции: Новинки без фолбэка на каталог
  const recs  = useMangaLazy(['/api/manga/recommendations?limit=20','/api/catalog?limit=20&sort=recommended','/api/catalog?limit=20']);
  const news  = useMangaLazy(['/api/manga/new?limit=20']); // только наш API
  const trend = useMangaLazy(['/api/manga/trending?limit=20','/api/catalog?limit=20&sort=trending']);
  const [activeSection, setActiveSection] = useState<SectionKey>('recs');

  const feed = useChapterFeed(20);

  // catalog
  const loadManga = useCallback(async () => {
    setLoadingManga(true);
    try {
      const json: any = await getJSON('/api/catalog?limit=50');
      const rows: MangaApiRow[] = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
      setMangaList(mapMangaRows(rows));
    } catch (e) { console.error('Error loading catalog:', e); setMangaList([]); }
    finally { setLoadingManga(false); }
  }, []);
  useEffect(() => { loadManga(); }, [loadManga]);

  useEffect(() => {
    const onPageShow = (e: any) => { if (e?.persisted) loadManga(); };
    const onFocus = () => loadManga();
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('focus', onFocus);
    return () => { window.removeEventListener('pageshow', onPageShow); window.removeEventListener('focus', onFocus); };
  }, [loadManga]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/banners', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((items: CarouselItem[]) => { if (!cancelled) setHeroItems(items || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const list = sp?.get('list') as MyListKey | null;
    setSelectedList(list && (MY_LISTS as readonly any[]).some((l) => l.key === list) ? list : null);
  }, [sp]);

  useEffect(() => {
    const s = sp?.get('section') as SectionKey | null;
    if (s && ['recs','new','trend'].includes(s)) setActiveSection(s);
  }, [sp]);

  useEffect(() => {
    if (!user?.id) return setUserListMap({});
    try {
      const raw = localStorage.getItem(`mp:userListMap:${user.id}`);
      setUserListMap(raw ? JSON.parse(raw) as MyListsMap : {});
    } catch { setUserListMap({}); }
  }, [user?.id]);

  // фоновый префетч секций
  useEffect(() => {
    let t1 = setTimeout(() => { if (recs.items.length === 0 && !recs.loading) recs.load(); }, 100);
    let t2 = setTimeout(() => { if (news.items.length === 0 && !news.loading) news.load(); }, 300);
    let t3 = setTimeout(() => { if (trend.items.length === 0 && !trend.loading) trend.load(); }, 600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openList = (key: MyListKey) => {
    if (!user) { setAuthModalMode('login'); setAuthModalOpen(true); return; }
    const params = new URLSearchParams(sp?.toString());
    params.set('list', key); params.delete('section');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    setActiveSection('recs');
    setSidebarOpen(false);
  };
  const openSection = async (key: SectionKey) => {
    setActiveSection(key);
    const params = new URLSearchParams(sp?.toString());
    params.set('section', key); params.delete('list');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    if (key === 'recs'  && recs.items.length  === 0 && !recs.loading)  await recs.load();
    if (key === 'new'   && news.items.length  === 0 && !news.loading)  await news.load();
    if (key === 'trend' && trend.items.length === 0 && !trend.loading) await trend.load();
    setTimeout(() => document.getElementById('results')?.scrollIntoView({ behavior:'smooth', block:'start' }), 0);
  };

  // ВАЖНО: никакой клиентской фильтрации новинок — это делает БД
  const gridData = useMemo(() => {
    if (user && selectedList) {
      const filtered = mangaList.filter((m) => (userListMap[String(m.id)] || []).includes(selectedList));
      return { title: (MY_LISTS.find((l)=>l.key===selectedList)?.label) || 'Мои списки', items: filtered, loading: loadingManga };
    }
    if (activeSection === 'recs')  return { title: 'Рекомендации',             items: recs.items,  loading: recs.loading  };
    if (activeSection === 'new')   return { title: 'Новинки',                   items: news.items,  loading: news.loading  };
    return                           { title: 'Набирает популярность',          items: trend.items, loading: trend.loading };
  }, [activeSection, recs, news.items, news.loading, trend, user, selectedList, mangaList, userListMap, loadingManga]);

  const filteredManga = mangaList.filter((i) => !searchQuery || i.title.toLowerCase().includes(searchQuery.toLowerCase()));

  const bgClass = theme === 'light' ? 'bg-white border-gray-200' : 'bg-slate-800/60 backdrop-blur-sm border-slate-700';
  const textClass = theme === 'light' ? 'text-gray-900' : 'text-white';
  const mutedTextClass = theme === 'light' ? 'text-gray-600' : 'text-slate-400';

  return (
    <div key={pathname} className={theme === 'light' ? 'min-h-screen bg-gray-50' : 'min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900'}>
      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black/50 z-30" />
            <motion.aside initial={{ x: -320 }} animate={{ x: 0 }} exit={{ x: -320 }} className="fixed left-0 top-0 h-full w-80 bg-slate-800 border-r border-slate-700 z-40 overflow-y-auto">
              <div className="p-6">
                <div className="mb-6 flex items-center justify между">
                  <h2 className="text-xl font-bold text-white">Мои списки</h2>
                  <button onClick={() => setSidebarOpen(false)} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors" aria-label="Закрыть">×</button>
                </div>

                {!user && (
                  <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3 text-sm text-slate-200 mb-6">
                    Войдите в аккаунт, чтобы смотреть свои списки.
                    <button onClick={() => { setAuthModalMode('login'); setAuthModalOpen(true); }} className="mt-3 w-full px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">Войти / Зарегистрироваться</button>
                  </div>
                )}

                <div className="space-y-1">
                  {MY_LISTS.map(({ key, label }) => {
                    const active = selectedList === key;
                    const base = 'w-full text-left px-3 py-2 rounded-lg transition-colors text-[15px] font-medium';
                    if (!user) return <div key={key} className={`${base} bg-slate-800/40 text-slate-300 select-none`}>{label}</div>;
                    return (
                      <button key={key} onClick={() => openList(key)} className={`${base} ${active ? 'bg-blue-600/30 text-white' : 'bg-slate-800/40 text-slate-200 hover:bg-slate-700/60'}`}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-80' : 'ml-0'}`}>
        <Header searchQuery={searchQuery} onSearchChange={setSearchQuery} showSearch={true} sidebarOpen={sidebarOpen} onSidebarToggle={() => setSidebarOpen(!sidebarOpen)} />

        <div className="p-6">
          {/* Баннеры */}
          <section className="mb-6"><HeroCarousel items={heroItems} /></section>

          {/* Лента новых глав — горизонтально */}
          <section className="mb-8" id="feed">
            <div className={`rounded-2xl border ${bgClass} overflow-hidden`}>
              <div className="p-4 flex items-center justify-between border-b border-slate-700/40">
                <div>
                  <h3 className={`text-lg font-semibold ${textClass}`}>Лента новых глав</h3>
                  <p className={`text-xs ${mutedTextClass}`}>
                    {feed.connected === 'sse' ? 'Автообновление (SSE)' : feed.connected === 'poll' ? 'Автообновление (poll)' : 'Загрузка…'}
                  </p>
                </div>
                <span className="text-xs px-2 py-1 rounded bg-blue-600/20 text-blue-300 border border-blue-500/30">Live</span>
              </div>

              {/* обёртка нужна для градиентных краёв */}
              <div className="relative">
                {/* градиенты по краям, зависят от темы */}
                <div className={clsx(
                  'pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r to-transparent',
                  theme === 'light' ? 'from-white' : 'from-slate-800/60'
                )} />
                <div className={clsx(
                  'pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l to-transparent',
                  theme === 'light' ? 'from-white' : 'from-slate-800/60'
                )} />

                <div className="overflow-x-auto feed-scroll">
                  {feed.items.length === 0 ? (
                    <div className={`p-6 text-sm ${mutedTextClass}`}>Пока без обновлений.</div>
                  ) : (
                    <div className="p-3 flex gap-4 min-h-[148px]">
                      {feed.items.map((it) => <FeedCard key={String(it.chapter_id)} item={it} />)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Три карточки секций */}
          <section className="mb-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SectionBlock title="Рекомендации" desc="Подборка на основе интересов" active={activeSection==='recs'} onClick={() => openSection('recs')} />
              <SectionBlock title="Новинки" desc="Свежие добавления" active={activeSection==='new'} onClick={() => openSection('new')} />
              <SectionBlock title="Набирает популярность" desc="То, что сейчас читают" active={activeSection==='trend'} onClick={() => openSection('trend')} />
            </div>
          </section>

          {/* Сетка выбранной секции / «Моих списков» */}
          <section id="results">
            <div className="flex items-center justify-between mb-6">
              <h1 className={`text-2xl font-bold ${textClass}`}>{gridData.title}</h1>
              <div className={mutedTextClass}>{gridData.loading ? 'Загрузка…' : `Найдено: ${gridData.items.length}`}</div>
            </div>

            {gridData.loading ? (
              <SkeletonGrid />
            ) : gridData.items.length === 0 ? (
              <div className={`text-center py-16 ${mutedTextClass}`}>Пока пусто.</div>
            ) : (
              <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                {gridData.items.map((manga) => <MangaCard key={`${gridData.title}-${manga.id}`} manga={manga} />)}
              </motion.div>
            )}
          </section>

          {/* Внизу — как раньше: сетка каталога по поиску */}
          {!!searchQuery && (
            <>
              <div className="flex items-center justify-between mb-6 mt-10">
                <h2 className={`text-xl font-bold ${textClass}`}>Результаты поиска</h2>
                <div className={mutedTextClass}>{loadingManga ? 'Загрузка…' : `Найдено: ${filteredManga.length}`}</div>
              </div>
              {loadingManga ? <SkeletonGrid /> : (
                <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                  {filteredManga.map((m) => <MangaCard key={`search-${m.id}`} manga={m} />)}
                </motion.div>
              )}
            </>
          )}
        </div>
      </main>

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} initialMode={authModalMode} />
    </div>
  );
}

/* =============== components =============== */
function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="rounded-xl overflow-hidden border animate-pulse bg-slate-800/40 border-slate-700/50">
          <div className="aspect-[3/4] bg-slate-700/40" />
          <div className="p-4 space-y-3">
            <div className="h-4 bg-slate-700/40 rounded w-3/4" />
            <div className="h-3 bg-slate-700/30 rounded w-1/2" />
            <div className="h-9 bg-slate-700/30 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionBlock({ title, desc, active, onClick }:{
  title: string; desc?: string; active?: boolean; onClick: () => void;
}) {
  const { theme } = useTheme();
  return (
    <motion.button
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={clsx(
        'w-full rounded-2xl border p-5 text-left transition-all relative overflow-hidden',
        theme==='light' ? 'bg-white border-gray-200 hover:border-blue-400' : 'bg-slate-800/60 border-slate-700 hover:border-blue-500/50',
        active && 'ring-2 ring-blue-500/40'
      )}
    >
      <div className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 rounded-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 blur-2xl" />
      <div className="flex items-start gap-3">
        <div>
          <div className="text-lg font-semibold">{title}</div>
          {desc && <div className={clsx('text-sm mt-1', theme==='light' ? 'text-gray-600' : 'text-slate-400')}>{desc}</div>}
        </div>
      </div>
    </motion.button>
  );
}

/* Карточка ленты — горизонтальная, фиксированная ширина */
function FeedCard({ item }: { item: ChapterFeedItem }) {
  const { theme } = useTheme();
  const textClass = theme === 'light' ? 'text-gray-900' : 'text-white';
  const mutedTextClass = theme === 'light' ? 'text-gray-600' : 'text-slate-400';
  const href = `/manga/${item.manga_id}?ch=${item.chapter_id}`;
  const chapterLabel = item.chapter_number ? `Глава ${item.chapter_number}` : 'Новая глава';
  const fresh = Date.now() - new Date(item.created_at).getTime() < 2 * 60 * 60 * 1000; // <2ч подсветим

  return (
    <Link href={href} className="block shrink-0">
      <div className={clsx(
        'w-[320px] sm:w-[360px] p-3 rounded-xl border transition-colors',
        fresh ? 'bg-green-500/5 hover:bg-green-500/10 border-green-500/30' : 'hover:bg-slate-700/30 border-slate-700/40'
      )}>
        <div className="flex gap-3">
          <div className="relative w-14 h-20 shrink-0 rounded overflow-hidden border border-slate-700/50">
            <Image src={safeImageSrc(item.cover_url)} alt={item.manga_title} fill className="object-cover" />
          </div>
          <div className="min-w-0">
            <div className={`text-sm font-medium line-clamp-2 ${textClass}`}>{item.manga_title}</div>
            <div className={`text-xs mt-0.5 ${mutedTextClass}`}>{chapterLabel}{item.volume ? ` · Том ${item.volume}` : ''}{item.team_name ? ` · ${item.team_name}` : ''}</div>
            <div className={`text-[11px] mt-1 ${mutedTextClass}`}>{formatTimeAgo(item.created_at)}</div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function MangaCard({ manga }: { manga: Manga }) {
  const { theme } = useTheme();
  const textClass = theme === 'light' ? 'text-gray-900' : 'text-white';
  const mutedTextClass = theme === 'light' ? 'text-gray-600' : 'text-slate-400';
  const bgClass = theme === 'light' ? 'bg-white border-gray-200' : 'bg-slate-800/60 backdrop-blur-sm border-slate-700';
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -8, scale: 1.02 }} className={`${bgClass} rounded-xl overflow-hidden hover:border-blue-500/50 transition-all duration-300 group`}>
      <div className="aspect-[3/4] relative overflow-hidden">
        <Image src={safeImageSrc((manga as any).cover_url)} alt={manga.title} fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        {manga.status && (
          <div className="absolute top-2 left-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${manga.status==='ongoing' ? 'bg-green-500 text-white' : manga.status==='completed' ? 'bg-blue-500 text-white' : 'bg-orange-500 text-white'}`}>
              {manga.status==='ongoing' ? 'Онгоинг' : manga.status==='completed' ? 'Завершено' : 'Заморожено'}
            </span>
          </div>
        )}
        <div className="absolute top-2 right-2">
          <div className="flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-full px-2 py-1">
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            <span className="text-xs text-white font-medium">{(manga.rating || 0).toFixed(1)}</span>
          </div>
        </div>
      </div>
      <div className="p-4">
        <h3 className={`font-semibold line-clamp-2 mb-2 ${textClass}`}>{manga.title}</h3>
        <div className={`flex items-center gap-4 text-xs ${mutedTextClass} mb-3`}>
          <div className="flex items-center gap-1"><BookOpen className="w-3 h-3" /><span>{manga.chapters_count || 0} глав</span></div>
          <div className="flex items-center gap-1"><Clock className="w-3 h-3" /><span>{String(manga.year)}</span></div>
        </div>
        {Array.isArray(manga.genres) && manga.genres.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {manga.genres.slice(0, 3).map((g, i) => (
              <span key={i} className={`px-2 py-1 rounded text-xs ${theme === 'light' ? 'bg-gray-100 text-gray-700' : 'bg-slate-700 text-slate-300'}`}>{g}</span>
            ))}
            {manga.genres.length > 3 && <span className={`px-2 py-1 rounded text-xs ${mutedTextClass}`}>+{manga.genres.length - 3}</span>}
          </div>
        )}
        <Link href={`/manga/${manga.id}`} className="block">
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">Читать</motion.button>
        </Link>
      </div>
    </motion.div>
  );
}
