'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import TitleBookmarks from '@/components/TitleBookmarks';
import RelatedTitlesRow from '@/components/RelatedTitlesRow';
import CommentSection from '@/components/comments/CommentSection';
import { romajiSlug, makeIdSlug } from '@/lib/slug';
import { MoreHorizontal, Eye } from 'lucide-react';

import { safeJson } from 'lib/utils';
import type {
  Chapter,
  ChapterGroup,
  Manga,
  Genre,
  RatingRow,
  Team,
  PersonLink,
  PublisherLink,
  MeInfo,
} from './types';

import { StarRating5Static } from './StarRating';
import RatingModalLinear from './RatingModalLinear';
import ChaptersPanel from './ChaptersPanel';
import DescriptionInfo from './DescriptionInfo';
import SidebarProgress from './SidebarProgress';

/* ==================== SSR initial ==================== */
interface InitialData {
  manga: Manga | null;
  chapters: Chapter[];
  genres: string[];
  tags: string[];
  ratings: RatingRow[];
  teams: Team[];
  me: MeInfo;
  authors: PersonLink[];
  artists: PersonLink[];
  publishers: PublisherLink[];
  bookmark: { chapter_id: number; page: number | null } | null;
}

interface Props {
  mangaId: number;
  initialData?: InitialData;
  isLoggedIn: boolean;
}

export default function MangaTitlePage({ mangaId, initialData, isLoggedIn }: Props) {
  const router = useRouter();

  const hasInitialData = !!initialData;

  const [manga, setManga] = React.useState<Manga | null>(initialData?.manga ?? null);
  const [chapters, setChapters] = React.useState<Chapter[]>(initialData?.chapters ?? []);
  const [genres, setGenres] = React.useState<Genre[]>(() => {
    if (!initialData?.genres) return [];
    return initialData.genres.map((name, i) => ({
      id: `local-${i}`,
      manga_id: mangaId,
      genre: name,
    })) as unknown as Genre[];
  });
  const [tags, setTags] = React.useState<string[]>(initialData?.tags ?? []);
  const [ratings, setRatings] = React.useState<RatingRow[]>(initialData?.ratings ?? []);
  const [teams, setTeams] = React.useState<Team[]>(initialData?.teams ?? []);
  const [me, setMe] = React.useState<MeInfo>(initialData?.me ?? null);
  const [authors, setAuthors] = React.useState<PersonLink[]>(initialData?.authors ?? []);
  const [artists, setArtists] = React.useState<PersonLink[]>(initialData?.artists ?? []);
  const [publishers, setPublishers] = React.useState<PublisherLink[]>(initialData?.publishers ?? []);
  const [bookmark, setBookmark] = React.useState(initialData?.bookmark ?? null);

  const [loading, setLoading] = React.useState(!hasInitialData);

  const realId = manga?.id ?? mangaId;
  const mid = realId;
  const logged = typeof isLoggedIn === 'boolean' ? isLoggedIn : !!me;
  const isGuest = !logged;

  const [tab, setTab] =
    React.useState<'description' | 'chapters' | 'comments' | 'team' | 'similar'>('description');
  const [rateOpen, setRateOpen] = React.useState(false);
  const [rateValue, setRateValue] = React.useState<number | null>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  const canEdit = (me?.role === 'moderator' || me?.role === 'admin') ?? false;
  const isLeader = Boolean(me?.leaderTeamId);

  /* ============ body scroll lock for rating modal ============ */
  React.useEffect(() => {
    const root = document.documentElement;
    if (rateOpen) {
      const sbw = window.innerWidth - root.clientWidth;
      root.classList.add('overflow-hidden');
      root.style.paddingRight = `${sbw}px`;
    } else {
      root.classList.remove('overflow-hidden');
      root.style.paddingRight = '';
    }
    return () => {
      root.classList.remove('overflow-hidden');
      root.style.paddingRight = '';
    };
  }, [rateOpen]);

  /* ============ outside click to close menu ============ */
  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const rawTitle = (manga?.original_title || manga?.title_romaji || manga?.title || '').trim();
  const slugCandidate = romajiSlug(rawTitle);
  const slugId = slugCandidate ? makeIdSlug(mid, slugCandidate) : String(mid);

  /* ============ PRETTY URL без навигации ============ */
  React.useEffect(() => {
    if (!manga) return;
    // Меняем строку браузера, но НЕ инициируем клиентскую навигацию Next
    const want = `/title/${slugId}`;
    if (typeof window !== 'undefined' && window.location.pathname !== want) {
      const url = new URL(window.location.href);
      url.pathname = want;
      window.history.replaceState(null, '', url.toString());
    }
  }, [manga, slugId]);

  /* ============ increment view count (robust) ============ */
  const viewFiredRef = React.useRef<Set<number>>(new Set());

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let aborted = false;

    const storageKey = `viewed:${mid}`;
    if (typeof window !== 'undefined' && sessionStorage.getItem(storageKey)) {
      return; // уже засчитано в этой вкладке
    }

    const isLikelyBot = () => {
      const ua = navigator.userAgent.toLowerCase();
      return /bot|crawl|spider|headless|lighthouse/.test(ua);
    };

    const incrementView = async () => {
      if (aborted || isLikelyBot()) return;

      try {
        const url = `/api/manga/${mid}/view`;

        // 1) Пытаемся отправить без блокировки навигации
        let usedBeacon = false;
        if ('sendBeacon' in navigator) {
          try {
            usedBeacon = navigator.sendBeacon(url, new Blob([]));
          } catch {
            usedBeacon = false;
          }
        }

        let data: any = null;

        if (usedBeacon) {
          // Ответ у beacon не прочитать — дешёвый GET сразу после
          const r = await fetch(url, { method: 'GET', credentials: 'include', cache: 'no-store' });
          data = await r.json().catch(() => ({ ok: false }));
        } else {
          // 2) Обычный POST (keepalive — чтобы доехал при уходе со страницы)
          const response = await fetch(url, {
            method: 'POST',
            credentials: 'include',
            keepalive: true,
          });
          data = await response.json().catch(() => ({ ok: false }));
        }

        if (aborted) return;

        if (data?.ok) {
          sessionStorage.setItem(storageKey, '1');
          setManga((prev) => {
            if (!prev) return prev;
            const nextViews =
              typeof data.views === 'number'
                ? data.views
                : prev.views ?? 0;
            return { ...prev, views: nextViews };
          });
        } else {
          // на крайний случай подберём views ещё одним GET
          try {
            const r = await fetch(url, { method: 'GET', credentials: 'include', cache: 'no-store' });
            const j = await r.json().catch(() => null);
            if (j?.ok && typeof j.views === 'number') {
              sessionStorage.setItem(storageKey, '1');
              setManga((prev) => (prev ? { ...prev, views: j.views } : prev));
            }
          } catch {}
        }
      } catch (error) {
        console.error('[incrementView] Error:', error);
      }
    };

    const scheduleIncrement = () => {
      timer = setTimeout(incrementView, 1000);
    };

    if (viewFiredRef.current.has(mangaId)) return;
    viewFiredRef.current.add(mangaId);

    if (document.visibilityState !== 'visible') {
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
          if (!aborted) scheduleIncrement();
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    } else {
      scheduleIncrement();
    }

    return () => {
      aborted = true;
      if (timer) clearTimeout(timer);
    };
  }, [mangaId, mid]);

  /* ============ client-side load when no initialData ============ */
  React.useEffect(() => {
    if (hasInitialData) {
      setLoading(false);
      return;
    }
    let stop = false;
    (async () => {
      try {
        const r = await fetch(`/api/manga/${mangaId}/bundle`, {
          credentials: 'include',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        const j = await safeJson<any>(r);
        if (stop) return;

        setManga(j?.manga ?? j?.item ?? null);

        const list = Array.isArray(j?.chapters) ? j.chapters : [];
        setChapters(
          list.map((c: any) => ({
            ...c,
            chapter_number: Number(c.chapter_number),
            vol_number: c.vol_number == null ? null : Number(c.vol_number),
          }))
        );

        const g = Array.isArray(j?.genres) ? j.genres : [];
        setGenres(
          g.map((name: string, i: number) => ({
            id: `local-${i}`,
            manga_id: mangaId,
            genre: name,
          })) as unknown as Genre[]
        );

        setTags(Array.isArray(j?.tags) ? j.tags : []);
        setRatings(Array.isArray(j?.ratings) ? j.ratings : []);
        setTeams(Array.isArray(j?.teams) ? j.teams : []);
        setMe(j?.me ?? null);
        setAuthors(Array.isArray(j?.authors) ? j.authors : []);
        setArtists(Array.isArray(j?.artists) ? j.artists : []);
        setPublishers(Array.isArray(j?.publishers) ? j.publishers : []);
        setBookmark(j?.bookmark ?? null);
      } catch (e) {
        console.error('[MangaTitlePage] bundle load error:', e);
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => {
      stop = true;
    };
  }, [hasInitialData, mangaId]);

  /* ============ rating aggregates ============ */
  const ratingAverage =
    ratings.length > 0
      ? Number((ratings.reduce((s, r) => s + (Number(r.rating) || 0), 0) / ratings.length).toFixed(2))
      : manga?.rating ?? 0;
  const ratingCount = ratings.length || (manga?.rating_count ?? 0);

  /* ============ group chapters by volume ============ */
  const chapterGroups: ChapterGroup[] = React.useMemo(() => {
    const map = new Map<number | 'no-vol', Chapter[]>();
    for (const ch of chapters) {
      const vol = ch.vol_number ?? null;
      const key: number | 'no-vol' = (vol ?? undefined) === undefined ? 'no-vol' : (vol as number);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ ...ch, chapter_number: Number(ch.chapter_number) });
    }
    const groups = Array.from(map.entries()).map(([k, arr]) => ({
      vol: k === 'no-vol' ? null : (k as number),
      items: arr.sort((a, b) => Number(b.chapter_number) - Number(a.chapter_number)),
    }));
    groups.sort((a, b) => {
      if (a.vol == null && b.vol == null) return 0;
      if (a.vol == null) return 1;
      if (b.vol == null) return -1;
      return b.vol - a.vol;
    });
    return groups;
  }, [chapters]);

  const firstChapterId = React.useMemo(() => {
    const all = chapters
      .map((ch) => ({ id: ch.id, n: Number(ch.chapter_number) }))
      .filter((x) => Number.isFinite(x.n))
      .sort((a, b) => a.n - b.n);
    return all[0]?.id ?? null;
  }, [chapters]);

  const reloadChapters = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/manga/${mid}/bundle`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data: any = await res.json();
      const list = Array.isArray(data?.chapters) ? data.chapters : [];
      setChapters(
        list.map((c: any) => ({
          ...c,
          chapter_number: Number(c.chapter_number),
          vol_number: c.vol_number == null ? null : Number(c.vol_number),
        }))
      );
    } catch (err) {
      console.error('[reloadChapters] Error:', err);
    }
  }, [mid]);

  const formatViews = React.useCallback((views: number): string => {
    const format = (n: number) => {
      const str = n.toFixed(1);
      return str.endsWith('.0') ? str.slice(0, -2) : str;
    };

    if (views >= 1_000_000) {
      return `${format(views / 1_000_000)}M`;
    }
    if (views >= 1_000) {
      return `${format(views / 1_000)}K`;
    }
    return String(views);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Header showSearch={false} />
        <div className="flex items-center justify-center h-[60vh] text-sm text-muted-foreground">
          Загрузка…
        </div>
      </div>
    );
  }

  if (!manga) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Header showSearch={false} />
        <div className="p-6 text-sm text-muted-foreground">Тайтл не найден.</div>
      </div>
    );
  }

  const rawDesc = (manga?.description ?? '').trim();
  const viewsCount = Number(manga?.views ?? 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header showSearch={false} />

      <div className="mx-auto max-w-[1400px] px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr_320px] gap-8">
          {/* LEFT COLUMN */}
          <div className="flex flex-col gap-4">
            <div className="relative rounded-2xl overflow-hidden w-full aspect-[2/3] border border-border/50 bg-card">
              <Image
                src={manga.cover_url || '/cover-placeholder.png'}
                alt={manga.title}
                fill
                priority
                className="object-cover"
              />
            </div>
            <div className="hidden lg:block">
              <TitleBookmarks mangaId={mid} loggedIn={logged} />
            </div>
          </div>

          {/* CENTER COLUMN */}
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-4xl font-bold mb-1">{manga.title}</h1>
              {(manga.original_title || manga.title_romaji) && (
                <p className="text-muted-foreground text-base">
                  {manga.original_title || manga.title_romaji}
                </p>
              )}
            </div>

            <div className="flex items-center gap-4 text-sm flex-wrap">
              <div className="flex items-center gap-4">
                <StarRating5Static value={ratingAverage} />
                <span className="text-muted-foreground">
                  {ratingAverage.toFixed(1)} ({ratingCount})
                </span>
              </div>

              {viewsCount > 0 && (
                <div
                  className="flex items-center gap-1.5 text-muted-foreground"
                  title={`${viewsCount.toLocaleString('ru-RU')} просмотров`}
                >
                  <Eye className="w-4 h-4" />
                  <span>{formatViews(viewsCount)}</span>
                </div>
              )}

              {isGuest ? (
                <span
                  className="ml-2 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs opacity-70 cursor-not-allowed select-none"
                  aria-disabled="true"
                  title="Войдите, чтобы оценить тайтл"
                >
                  Оценить
                </span>
              ) : (
                <button
                  onClick={() => {
                    setRateOpen(true);
                    setRateValue(Math.round(ratingAverage) || 7);
                  }}
                  className="ml-2 px-3 py-1.5 rounded-lg bg-muted hover:opacity-90 text-xs transition-colors border border-border"
                  aria-label="Оценить тайтл"
                >
                  Оценить
                </button>
              )}

              <div className="relative ml-auto" ref={menuRef}>
                <button
                  className="px-3 py-2 bg-muted rounded-lg transition-colors border border-border hover:opacity-90"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label="Дополнительные действия"
                  aria-expanded={menuOpen}
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>

                {menuOpen && (
                  <div className="absolute right-full mr-3 top-1/2 -translate-y-[63px] w-56 rounded-lg border border-border bg-card shadow-lg z-20 overflow-hidden">
                    {isGuest ? (
                      <div
                        aria-disabled="true"
                        className="block h-10 px-3 flex items-center text-sm text-muted-foreground opacity-70 cursor-not-allowed"
                      >
                        Сообщить об ошибке
                      </div>
                    ) : (
                      <Link
                        href={`/title/${mid}/error`}
                        className="block h-10 px-3 flex items-center text-sm hover:bg-muted transition"
                      >
                        Сообщить об ошибке
                      </Link>
                    )}
                    {isGuest ? (
                      <div
                        aria-disabled="true"
                        className="block h-10 px-3 flex items-center text-sm text-muted-foreground opacity-70 cursor-not-allowed"
                      >
                        Редактировать тайтл
                      </div>
                    ) : (
                      <Link
                        href={`/title/${mid}/edit`}
                        className="block h-10 px-3 flex items-center text-sm hover:bg-muted transition"
                      >
                        Редактировать тайтл
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-6 border-b border-border mt-2">
              {(['description', 'chapters', 'comments', 'team', 'similar'] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`pb-3 px-1 border-b-2 transition-colors ${
                    tab === k
                      ? 'border-accent text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                  aria-label={
                    k === 'description'
                      ? 'О тайтле'
                      : k === 'chapters'
                      ? 'Главы'
                      : k === 'comments'
                      ? 'Комментарии'
                      : k === 'team'
                      ? 'Команда'
                      : 'Связанное'
                  }
                >
                  {k === 'description'
                    ? 'О тайтле'
                    : k === 'chapters'
                    ? 'Главы'
                    : k === 'comments'
                    ? 'Комментарии'
                    : k === 'team'
                    ? 'Команда'
                    : 'Связанное'}
                </button>
              ))}
            </div>

            <div className="mt-4">
              {tab === 'description' && (
                <DescriptionInfo
                  manga={manga}
                  rawDesc={rawDesc}
                  authors={authors}
                  artists={artists}
                  publishers={publishers}
                  genres={genres}
                  tags={tags}
                />
              )}

              {tab === 'chapters' && (
                <ChaptersPanel
                  canEdit={canEdit}
                  isLeader={isLeader}
                  onAdded={reloadChapters}
                  groups={chapterGroups}
                  slugId={slugId}
                  bookmark={bookmark}
                  mid={mid}
                  chapters={chapters}
                />
              )}

              {tab === 'comments' && (
                <div className="block">
                  <CommentSection
                    mangaId={mid}
                    me={me ? { id: me.id, role: me.role ?? null } : null}
                    canEdit={canEdit}
                    leaderTeamId={me?.leaderTeamId ?? null}
                  />
                </div>
              )}

              {tab === 'team' && (
                <div className="text-foreground/90">
                  <div className="space-y-4">
                    {teams.length === 0 && (
                      <p className="text-muted-foreground">Команды не привязаны</p>
                    )}
                    {teams.map((t) => (
                      <Link
                        key={t.id}
                        href={`/team/${t.slug ?? String(t.id)}`}
                        className="block p-4 bg-card hover:bg-card/90 border border-border rounded-lg transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {t.avatar_url ? (
                            <img
                              src={t.avatar_url}
                              alt={t.name}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-foreground font-semibold">
                              {t.name[0]?.toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-medium">{t.name}</div>
                            <div className="text-sm text-muted-foreground">
                              Команда переводчиков
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {tab === 'similar' && (
                <div className="-mt-2">
                  <RelatedTitlesRow mangaId={mid} />
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="flex flex-col gap-4">
            <SidebarProgress
              bookmark={bookmark}
              chapters={chapters}
              slugId={slugId}
              firstChapterId={firstChapterId}
            />

            <div className="rounded-xl p-4 bg-card border border-border">
              <h3 className="text-sm font-medium mb-3">Обновления</h3>
              <div className="space-y-3 text-sm">
                {chapters.slice(0, 3).map((ch) => (
                  <div key={ch.id} className="flex justify-between items-center">
                    <span className="text-foreground/90">Глава {ch.chapter_number}</span>
                    <span className="text-muted-foreground text-xs">
                      {new Date(ch.created_at).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                ))}
                {firstChapterId && !bookmark && (
                  <Link
                    href={`/title/${slugId}/chapter/${firstChapterId}`}
                    className="inline-block mt-2 rounded-md bg-muted px-3 py-2 text-sm border border-border hover:opacity-90 transition-colors"
                  >
                    Начать чтение
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {rateOpen && (
        <RatingModalLinear
          open={rateOpen}
          value={rateValue ?? 7}
          onChange={(v) => setRateValue(v)}
          onClose={() => setRateOpen(false)}
          onSave={() => {
            if (rateValue) handleRate(rateValue);
            setRateOpen(false);
          }}
        />
      )}
    </div>
  );

  async function handleRate(value: number) {
    if (!me) return;

    try {
      const r = await fetch(`/api/manga/${mid}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rating: value }),
      });
      const j = await safeJson<{ ok?: boolean; message?: string }>(r);
      if (!r.ok) throw new Error(j?.message || `HTTP ${r.status}`);
      router.refresh();
    } catch (err) {
      console.error('Rating error:', err);
    }
  }
}
