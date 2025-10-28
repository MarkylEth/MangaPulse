//components\home\HomePage.tsx
'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Clock, Plus, Sparkles, TrendingUp } from 'lucide-react';

import { Header } from '@/components/Header';
import HeroCarousel from '@/components/home/HeroCarousel';
import AddNewsModal from '@/components/news/AddNewsModal';

import TopRatedRail from '@/components/home/TopRatedRail';
import CompactMangaCard from '@/components/home/CompactMangaCard';
import MiniMangaCard from '@/components/home/MiniMangaCard';
import TeamNewsRow from '@/components/news/TeamNewsRow';
import CompactFeedRow from '@/components/feed/CompactFeedRow';

import { clsx, getJSON } from '@/lib/utils';
import { useChapterFeed } from '@/hooks/useChapterFeed';
import { useTeamNews, useCanPostNews } from '@/hooks/useTeamNews';
import { useMangaCatalog } from '@/hooks/useMangaCatalog';
import type { CarouselItem, Manga } from '@/components/home/types';

export default function HomePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredQuery = useDeferredValue(searchQuery);

  const [sortBy, setSortBy] = useState<'rating'|'new'|'trending'>('rating');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterGenre, setFilterGenre] = useState<string>('all');

  const [heroItems, setHeroItems] = useState<CarouselItem[]>([]);
  useEffect(() => {
    let cancelled = false;
    getJSON<CarouselItem[]>('/api/banners')
      .then((items) => { if (!cancelled) setHeroItems(Array.isArray(items) ? items : []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const { mangaList, loading, genres, topRated, recentUpdates } = useMangaCatalog(50);
  const teamNews = useTeamNews(4);
  const canPostNews = useCanPostNews();
  const feed = useChapterFeed(24);

  const allGenres = genres;

  const sortedAndFiltered = useMemo(() => {
    let result: Manga[] = [...mangaList];
    if (filterStatus !== 'all') result = result.filter(m => m.status?.toLowerCase() === filterStatus);
    if (filterGenre !== 'all') result = result.filter(m => m.genres?.includes(filterGenre));
    if (sortBy === 'rating') {
      result.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === 'new') {
      result.sort((a, b) => {
        const dateA = a.created_at_iso ? new Date(a.created_at_iso).getTime() : 0;
        const dateB = b.created_at_iso ? new Date(b.created_at_iso).getTime() : 0;
        return dateB - dateA;
      });
    } else if (sortBy === 'trending') {
      // заглушка: пока сортируем как по рейтингу
      result.sort((a, b) => b.rating - a.rating);
    }
    return result;
  }, [mangaList, sortBy, filterStatus, filterGenre]);

  const filtered = useMemo(() =>
    !deferredQuery
      ? sortedAndFiltered
      : sortedAndFiltered.filter(m => m.title.toLowerCase().includes(deferredQuery.toLowerCase()))
  , [sortedAndFiltered, deferredQuery]);

  const subtle = 'text-muted-foreground';

  return (
    <div className="min-h-screen relative bg-background text-foreground">
      {/* Ambient background effect */}
      <div className="fixed inset-0 pointer-events-none opacity-30">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          showSearch
          sidebarOpen={sidebarOpen}
          onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
        />
      </div>

      <div className="relative mx-auto max-w-[1600px] px-4 md:px-8 py-6">
        {/* Баннеры */}
        <section className="mb-8 overflow-hidden rounded-xl relative group">
          <div className="absolute inset-0 bg-gradient-to-t from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <HeroCarousel items={heroItems} />
        </section>

        {/* Top Rated — плавная contained-лента */}
        {!deferredQuery && topRated.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card/80 border border-border shadow-md">
                  <div className="flex gap-0.5">
                    <span className="w-1 h-4 bg-muted rounded-full animate-pulse" />
                    <span className="w-1 h-4 bg-muted rounded-full animate-pulse" style={{animationDelay: '0.2s'}} />
                    <span className="w-1 h-4 bg-muted rounded-full animate-pulse" style={{animationDelay: '0.4s'}} />
                  </div>
                  <span className="text-xl font-bold tracking-wider text-card-foreground">Топ недели</span>
                </div>
              </div>
            </div>
            <TopRatedRail items={topRated} />
          </section>
        )}

        {/* Toolbar: Sort + Filters */}
        <div className="mb-6 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between pb-4 border-b border-border/30">
          <div className="flex flex-wrap items-center gap-3">
            <span className={clsx('text-sm', subtle)}>Сортировка:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setSortBy('rating')}
                className={clsx(
                  'px-3 py-1.5 text-sm rounded-lg transition-all relative overflow-hidden',
                  sortBy === 'rating'
                    ? 'bg-card text-card-foreground border border-border'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                {sortBy === 'rating' && <span className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-transparent" />}
                <span className="relative">По рейтингу</span>
              </button>
              <button
                onClick={() => setSortBy('new')}
                className={clsx(
                  'px-3 py-1.5 text-sm rounded-lg transition-all relative overflow-hidden',
                  sortBy === 'new'
                    ? 'bg-card text-card-foreground border border-border'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                {sortBy === 'new' && <span className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent" />}
                <span className="relative">Новинки</span>
              </button>
              <button
                onClick={() => setSortBy('trending')}
                className={clsx(
                  'px-3 py-1.5 text-sm rounded-lg transition-all relative overflow-hidden',
                  sortBy === 'trending'
                    ? 'bg-card text-card-foreground border border-border'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                {sortBy === 'trending' && <span className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent" />}
                <span className="relative">В тренде</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Grid + Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
          {/* Content */}
          <main className="min-w-0">
            <section id="results" className="space-y-5">
              <div className="flex items-baseline justify-between">
                <h1 className="text-xl font-medium">{deferredQuery ? 'Результаты поиска' : 'Каталог'}</h1>
                <span className={clsx('text-sm', subtle)}>
                  {loading ? 'Загрузка…' : `${filtered.length} тайтлов`}
                </span>
              </div>

              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="overflow-hidden">
                      <div className="aspect-[3/4] bg-muted animate-pulse rounded-lg" />
                      <div className="mt-2 space-y-2">
                        <div className="h-3 bg-muted rounded w-3/4" />
                        <div className="h-2 bg-muted rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className={clsx('text-center py-20', subtle)}>Ничего не найдено</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                  {filtered.map((manga) => (
                    <CompactMangaCard key={manga.id} manga={manga} />
                  ))}
                </div>
              )}
            </section>

            {/* Random Discovery Section */}
            {!deferredQuery && recentUpdates.length > 0 && (
              <section className="mt-12 pt-8 border-t border-border/30">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    <h2 className="text-xl font-medium">Недавно обновлено</h2>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  {recentUpdates.map((manga) => (
                    <MiniMangaCard key={manga.id} manga={manga} />
                  ))}
                </div>
              </section>
            )}

            {/* Genre Explorer */}
            {!deferredQuery && allGenres.length > 0 && (
              <section className="mt-12 pt-8 border-t border-border/30">
                <div className="flex items-center gap-2 mb-6">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  <h2 className="text-xl font-medium">Популярные жанры</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {allGenres.slice(0, 12).map((genre) => {
                    const count = mangaList.filter(m => m.genres?.includes(genre)).length;
                    return (
                      <button
                        key={genre}
                        onClick={() => setFilterGenre(genre)}
                        className="group relative overflow-hidden px-4 py-2 rounded-lg bg-card/40 border border-border/50 hover:border-border transition-all hover:shadow-lg hover:shadow-black/20"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-400/10 to-indigo-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative flex items-center gap-2">
                          <span className="text-sm font-medium">{genre}</span>
                          <span className="text-xs text-muted-foreground">{count}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </main>

          {/* Sidebar: Recent Chapters Feed + Project News */}
          <aside className="space-y-6">
            <div className="sticky top-20 space-y-6">
              {/* Recent Chapters Feed */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-muted-foreground" />
                    <h2 className="text-lg font-medium">Последние главы</h2>
                  </div>
                  <div className={clsx(
                    'text-xs px-2 py-1 rounded-full flex items-center gap-1.5',
                    feed.connected === 'sse' ? 'bg-emerald-500/10 text-emerald-400' :
                    'bg-muted text-muted-foreground'
                  )}>
                    <span className={clsx('w-1.5 h-1.5 rounded-full',
                      feed.connected === 'sse' ? 'bg-emerald-400 animate-pulse' : 'bg-muted-foreground'
                    )} />
                    {feed.connected === 'sse' ? 'Live' : 'Auto'}
                  </div>
                </div>

                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                  {feed.items.length === 0 ? (
                    <div className={clsx('text-sm py-8 text-center', subtle)}>Нет обновлений</div>
                  ) : (
                    feed.items.slice(0, 15).map((it, idx) => (
                      <CompactFeedRow key={String(it.chapter_id)} item={it} isNew={idx < 3} />
                    ))
                  )}
                </div>
              </div>

              {/* Project News Section */}
              <HomeNewsPanel canPostNews={canPostNews} teamNews={teamNews} />
            </div>
          </aside>
        </div>

        {/* Footer Section */}
        <HomeFooter
          titlesCount={mangaList.length}
          updatesCount={feed.items.length}
          genresCount={allGenres.length}
        />
      </div>
    </div>
  );
}

function HomeNewsPanel({
  canPostNews,
  teamNews,
}: {
  canPostNews: boolean;
  teamNews: ReturnType<typeof useTeamNews>;
}) {
  const [newsModalOpen, setNewsModalOpen] = useState(false);
  return (
    <div className="rounded-lg bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <h3 className="text-lg font-medium">Новости проекта</h3>
        </div>
        {canPostNews && (
          <button
            onClick={() => setNewsModalOpen(true)}
            className="h-8 w-8 grid place-items-center rounded-md border border-accent/30 hover:bg-accent/10"
            title="Добавить новость"
            aria-label="Добавить новость"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-3">
        {teamNews.loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-12 rounded-lg border border-accent/20 bg-accent/10 animate-pulse"
            />
          ))
        ) : teamNews.items.length === 0 ? (
          <div className="text-sm text-muted-foreground">Пока нет новостей.</div>
        ) : (
          teamNews.items.slice(0, 4).map((it) => <TeamNewsRow key={it.id} it={it} />)
        )}
      </div>

      <a
        href="/news"
        className="mt-4 block text-center text-sm text-indigo-400 hover:opacity-80 transition-opacity"
      >
        Все новости →
      </a>

      {canPostNews && (
        <AddNewsModal
          isOpen={newsModalOpen}
          onClose={() => setNewsModalOpen(false)}
          onCreated={() => {
            setNewsModalOpen(false);
            teamNews.reload();
          }}
        />
      )}
    </div>
  );
}

function HomeFooter({
  titlesCount,
  updatesCount,
  genresCount,
}: {
  titlesCount: number;
  updatesCount: number;
  genresCount: number;
}) {
  return (
    <footer className="mt-16 pt-8 border-t border-border/30">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
        <div>
          <h3 className="text-sm font-medium mb-3 text-muted-foreground">О проекте</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Читайте мангу онлайн бесплатно. Огромная коллекция тайтлов с ежедневными обновлениями.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium mb-3 text-muted-foreground">Быстрые ссылки</h3>
          <div className="space-y-2">
            <a href="/catalog" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">
              Полный каталог
            </a>
            <a href="/genres" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">
              Жанры
            </a>
            <a href="/popular" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">
              Популярное
            </a>
          </div>
        </div>
        <div>
          <h3 className="text-sm font-medium mb-3 text-muted-foreground">Статистика</h3>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Тайтлов в базе:</span>
              <span className="text-foreground font-medium">{titlesCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Обновлений сегодня:</span>
              <span className="text-foreground font-medium">{updatesCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Активных жанров:</span>
              <span className="text-foreground font-medium">{genresCount}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="text-center py-6 text-xs text-muted-foreground">
        <p>© 2025 MangaPulse. Все права защищены.</p>
      </div>
    </footer>
  );
}
