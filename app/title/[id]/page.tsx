'use client';

import './globals.css';
import { useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Clock, Star, Sparkles, Flame } from 'lucide-react';
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
export type MangaApiRow = { id: number|string; title: string; cover_url?: string|null; status?: string|null; rating?: number|null; rating10?: number|null; chapters?: number|null; chapters_count?: number|null; genres?: string[]|string|null; genres2?: string[]|string|null; release_year?: number|null; release_date?: string|null; created_at: string; };
export type Manga = { id: number|string; title: string; cover_url?: string|null; status?: string|null; rating: number; chapters_count: number; genres?: string[]; year: number; };
export type ChapterFeedItem = {
  chapter_id: string|number;
  chapter_title?: string|null;   // название главы (может отсутствовать)
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
    const rating10 = typeof item.rating10 === 'number' ? item.rating10 : typeof item.rating === 'number' ? Math.max(0, Math.min(10, item.rating * (item.rating <= 5 ? 2 : 1))) : 0;
    const genresArr = Array.isArray(item.genres) ? item.genres.map(String) : asList(item.genres ?? item.genres2 ?? null);
    const y = typeof item.release_year === 'number' ? item.release_year : item.release_date ? new Date(item.release_date).getFullYear() : new Date(item.created_at).getFullYear();
    return { id: item.id, title: item.title ?? 'Без названия', cover_url: item.cover_url ?? null, status: item.status ?? undefined, rating: toNumber(rating10, 0), chapters_count: toNumber(item.chapters_count ?? item.chapters, 0), genres: genresArr, year: Number.isFinite(y) ? y : new Date(item.created_at).getFullYear() };
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
      } catch (e) { console.warn('section fetch failed', u, e); }
    }
    setItems([]); setLoading(false); return false;
  }, []);

  return { items, loading, load };
}

function useChapterFeed(initialLimit = 15) {
  const [items, setItems] = useState<ChapterFeedItem[]>([]);
  const seen = useRef(new Set<string|number>());
  const [connected, setConnected] = useState<'sse'|'poll'|'none'>('none');

  const upsert = useCallback((arr: ChapterFeedItem[]) => {
    if (!arr?.length) return;
    setItems((prev) => {
      const next = [...prev];
      for (const it of arr) {
        if (!seen.current.has(it.chapter_id)) {
          seen.current.add(it.chapter_id);
          next.unshift(it);
        }
      }
      return next.slice(0, 100);
    });
  }, []);

  const loadInitial = useCallback(async () => {
    try {
      const json: any = await getJSON(`/api/chapters/latest?limit=${initialLimit}`);
      const rows: ChapterFeedItem[] = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
      upsert(rows);
    } catch (e) { console.warn('feed init failed', e); }
  }, [initialLimit, upsert]);

  useEffect(() => {
    let closed = false;
    loadInitial();
    try {
      const es = new EventSource('/api/chapters/stream');
      es.onopen = () => setConnected('sse');
      es.onerror = () => { if (!closed) { setConnected('poll'); es.close(); } };
      es.onmessage = (ev) => { try { const p = JSON.parse(ev.data); upsert(Array.isArray(p) ? p : [p]); } catch {} };
      return () => { closed = true; es.close(); };
    } catch { setConnected('poll'); }
  }, [upsert, loadInitial]);

  useEffect(() => {
    if (connected !== 'poll') return;
    let t: any, paused = document.hidden;
    const tick = async () => {
      try { const json: any = await getJSON(`/api/chapters/latest?limit=${initialLimit}`); upsert(Array.isArray(json?.data) ? json.data : json); } catch {}
      t = setTimeout(tick, paused ? 45000 : 20000);
    };
    const onVis = () => { paused = document.hidden; };
    tick(); document.addEventListener('visibilitychange', onVis);
    return () => { clearTimeout(t); document.removeEventListener('visibilitychange', onVis); };
  }, [connected, initialLimit, upsert]);

  return { items, connected };
}

/* =============== page =============== */
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

  type CarouselItem = { id: number; title: string; coverUrl: string; href: string };
  const [heroItems, setHeroItems] = useState<CarouselItem[]>([]);

  const [selectedList, setSelectedList] = useState<MyListKey | null>(null);
  const [userListMap, setUserListMap] = useState<MyListsMap>({});

  // секции
  const recs  = useMangaLazy(['/api/manga/recommendations?limit=20','/api/catalog?limit=20&sort=recommended','/api/catalog?limit=20']);
  const news  = useMangaLazy(['/api/manga/new?limit=20','/api/catalog?limit=20&sort=new']);
  const trend = useMangaLazy(['/api/manga/trending?limit=20','/api/catalog?limit=20&sort=trending']);
  const [activeSection, setActiveSection] = useState<SectionKey>('recs');

  const feed = useChapterFeed(15);

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

  const gridData = useMemo(() => {
    if (user && selectedList) {
      const filtered = mangaList.filter((m) => (userListMap[String(m.id)] || []).includes(selectedList));
      return { title: (MY_LISTS.find((l)=>l.key===selectedList)?.label) || 'Мои списки', items: filtered, loading: loadingManga };
    }
    if (activeSection === 'recs')  return { title: 'Рекомендации',             items: recs.items,  loading: recs.loading  };
    if (activeSection === 'new')   return { title: 'Новинки',                   items: news.items,  loading: news.loading  };
    return                           { title: 'Набирает популярность',          items: trend.items, loading: trend.loading };
  }, [activeSection, recs, news, trend, user, selectedList, mangaList, userListMap, loadingManga]);

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
                <div className="mb-6 flex items-center justify-between">
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

          {/* Лента новых глав — сразу под баннером */}
          <section className="mb-8" id="feed">
            <div className={`rounded-2xl border ${bgClass} overflow-hidden`}>
              <div className="p-4 flex items-center justify-between border-b border-slate-700/40">
                <div>
                  <h3 className={`text-lg font-semibold ${textClass}`}> Новые главы</h3>
                  <p className={`text-xs ${mutedTextClass}`}>{feed.connected === 'sse' ? 'Автообновление (SSE)' : feed.connected === 'poll' ? 'Автообновление (poll)' : 'Загрузка…'}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded bg-blue-600/20 text-blue-300 border border-blue-500/30">Live</span>
              </div>
              <div className="max-h-[50vh] overflow-y-auto divide-y divide-slate-700/40">
                {feed.items.length === 0 ? (
                  <div className={`p-6 text-sm ${mutedTextClass}`}>Пока без обновлений.</div>
                ) : (
                  feed.items.map((it) => <FeedRow key={it.chapter_id} item={it} />)
                )}
              </div>
            </div>
          </section>

          {/* Три большие карточки-блока */}
          <section className="mb-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SectionBlock title="Рекомендации" desc="Подборка на основе интересов" icon={<Sparkles className="w-5 h-5" />} active={activeSection==='recs'} onClick={() => openSection('recs')} />
              <SectionBlock title="Новинки" desc="Свежие добавления" icon={<Clock className="w-5 h-5" />} active={activeSection==='new'} onClick={() => openSection('new')} />
              <SectionBlock title="Набирает популярность" desc="То, что сейчас читают" icon={<Flame className="w-5 h-5" />} active={activeSection==='trend'} onClick={() => openSection('trend')} />
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

          {/* Внизу — как раньше: твоя сетка каталога по поиску */}
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

function SectionBlock({ title, desc, icon, active, onClick }:{
  title: string; desc?: string; icon?: ReactNode; active?: boolean; onClick: () => void;
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
        {icon && <div className="mt-1 grid place-items-center w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20">{icon}</div>}
        <div>
          <div className="text-lg font-semibold flex items-center gap-2">
            {title}
            {active && <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-300 border border-blue-500/30">Открыто</span>}
          </div>
          {desc && <div className={clsx('text-sm mt-1', theme==='light' ? 'text-gray-600' : 'text-slate-400')}>{desc}</div>}
        </div>
      </div>
    </motion.button>
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

function FeedRow({ item }: { item: ChapterFeedItem }) {
  const { theme } = useTheme();
  const textClass = theme === 'light' ? 'text-gray-900' : 'text-white';
  const mutedTextClass = theme === 'light' ? 'text-gray-600' : 'text-slate-400';

  const href = `/manga/${item.manga_id}?ch=${item.chapter_id}`;

  // Мета: "Том N · Глава M — Название"
  const volPart = item.volume ? `Том ${item.volume}` : null;
  const chPart  = item.chapter_number ? `Глава ${item.chapter_number}` : null;
  const base    = [volPart, chPart].filter(Boolean).join(' · ');
  const title   = (item.chapter_title ?? '').trim();
  const meta    = title ? (base ? `${base} — ${title}` : title) : base || 'Новая глава';

  const fresh = Date.now() - new Date(item.created_at).getTime() < 2 * 60 * 60 * 1000; // < 2ч

  return (
    <Link href={href} className="block">
      <div className={clsx(
        'p-3 flex gap-3 transition-colors rounded-xl border',
        theme === 'light'
          ? (fresh ? 'bg-green-50 border-green-100 hover:bg-green-100/60' : 'hover:bg-gray-100/60 border-gray-200')
          : (fresh ? 'bg-green-500/5 border-green-500/20 hover:bg-green-500/10' : 'hover:bg-slate-700/30 border-slate-700/50')
      )}>
        <div className="relative w-[52px] h-[74px] sm:w-14 sm:h-20 shrink-0 rounded overflow-hidden">
          <Image
            src={safeImageSrc(item.cover_url)}
            alt={item.manga_title}
            fill
            className="object-cover"
          />
        </div>

        <div className="min-w-0">
          {/* Название тайтла — жирным */}
          <div className={clsx('text-sm font-semibold line-clamp-2', textClass)}>
            {item.manga_title}
          </div>

          {/* Том · Глава — Название (+ команда, если есть) */}
          <div className={clsx('text-xs mt-0.5 line-clamp-2', mutedTextClass)}>
            {meta}
            {item.team_name ? ` · ${item.team_name}` : ''}
          </div>

          {/* Когда добавлено */}
          <div className={clsx('text-[11px] mt-1', mutedTextClass)}>
            {formatTimeAgo(item.created_at)}
          </div>
        </div>
      </div>
    </Link>
  );
}
