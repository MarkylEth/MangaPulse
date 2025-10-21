// components/title-page/MangaTitlePage.tsx
'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import TitleBookmarks from '@/components/TitleBookmarks';
import RelatedTitlesRow from '@/components/RelatedTitlesRow';
import CommentSection from '@/components/comments/CommentSection';
import { romajiSlug, makeIdSlug } from '@/lib/slug';
import { MoreHorizontal } from 'lucide-react';

import { useMangaBundle } from '../../hooks/MangaHooks';
import { safeJson } from 'lib/utils';
import type { MangaTitlePageProps, Chapter, ChapterGroup, Manga, Genre, RatingRow, Team, PersonLink, PublisherLink, MeInfo } from './types';

import { StarRating5Static } from './StarRating';
import RatingModalLinear from './RatingModalLinear';
import ChaptersPanel from './ChaptersPanel';
import DescriptionInfo from './DescriptionInfo';
import SidebarProgress from './SidebarProgress';

// Новый тип для SSR данных
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
  initialData?: InitialData; // NEW: все данные сразу
  isLoggedIn: boolean;
}

export default function MangaTitlePage({ mangaId, initialData, isLoggedIn }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  // Если есть initialData, используем напрямую, иначе загружаем через хук
  const hasInitialData = !!initialData;

  const [manga, setManga] = React.useState<Manga | null>(initialData?.manga ?? null);
  const [chapters, setChapters] = React.useState<Chapter[]>(initialData?.chapters ?? []);
  const [genres, setGenres] = React.useState<Genre[]>(() => {
    if (!initialData?.genres) return [];
    return initialData.genres.map((name, i) => ({
      id: `local-${i}`,
      manga_id: mangaId,
      genre: name,
    }));
  });
  const [tags, setTags] = React.useState<string[]>(initialData?.tags ?? []);
  const [ratings, setRatings] = React.useState<RatingRow[]>(initialData?.ratings ?? []);
  const [teams, setTeams] = React.useState<Team[]>(initialData?.teams ?? []);
  const [me, setMe] = React.useState<MeInfo>(initialData?.me ?? null);
  const [authors, setAuthors] = React.useState<PersonLink[]>(initialData?.authors ?? []);
  const [artists, setArtists] = React.useState<PersonLink[]>(initialData?.artists ?? []);
  const [publishers, setPublishers] = React.useState<PublisherLink[]>(initialData?.publishers ?? []);
  const [bookmark, setBookmark] = React.useState(initialData?.bookmark ?? null);

  const realId = manga?.id ?? mangaId;
  const mid = realId;
  const logged = typeof isLoggedIn === 'boolean' ? isLoggedIn : !!me;
  const isGuest = !logged;

  const [tab, setTab] = React.useState<'description' | 'chapters' | 'comments' | 'team' | 'similar'>('description');
  const [rateOpen, setRateOpen] = React.useState(false);
  const [rateValue, setRateValue] = React.useState<number | null>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(!hasInitialData);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  const canEdit = (me?.role === 'moderator' || me?.role === 'admin') ?? false;
  const isLeader = Boolean(me?.leaderTeamId);

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

  React.useEffect(() => {
    if (!manga) return;
    const want = `/title/${slugId}`;
    if (pathname !== want) router.replace(want, { scroll: false });
  }, [manga, slugId, pathname, router]);

  const ratingAverage =
    ratings.length > 0
      ? Number((ratings.reduce((s, r) => s + (Number(r.rating) || 0), 0) / ratings.length).toFixed(2))
      : manga?.rating ?? 0;
  const ratingCount = ratings.length || (manga?.rating_count ?? 0);

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

  if (loading)
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Header showSearch={false} />
        <div className="flex items-center justify-center h-[60vh] text-sm text-muted-foreground">Загрузка…</div>
      </div>
    );

  if (!manga)
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Header showSearch={false} />
        <div className="p-6 text-sm text-muted-foreground">Тайтл не найден.</div>
      </div>
    );

  const rawDesc = (manga?.description ?? '').trim();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header showSearch={false} />

      <div className="mx-auto max-w-[1400px] px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr_320px] gap-8">
          <div className="flex flex-col gap-4">
            <div className="relative rounded-2xl overflow-hidden w-full aspect-[2/3] border border-border/50 bg-card">
              <Image src={manga.cover_url || '/cover-placeholder.png'} alt={manga.title} fill priority className="object-cover" />
            </div>
            <div className="hidden lg:block">
              <TitleBookmarks mangaId={mid} loggedIn={logged} />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-4xl font-bold mb-1">{manga.title}</h1>
              {(manga.original_title || manga.title_romaji) && (
                <p className="text-muted-foreground text-base">{manga.original_title || manga.title_romaji}</p>
              )}
            </div>

            <div className="flex items-center gap-4 text-sm">
              <StarRating5Static value={ratingAverage} />
              <span className="text-muted-foreground">{ratingAverage.toFixed(1)} ({ratingCount})</span>

              {isGuest ? (
                <span className="ml-2 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs opacity-70 cursor-not-allowed select-none" aria-disabled="true">
                  Оценить
                </span>
              ) : (
                <button
                  onClick={() => { setRateOpen(true); setRateValue(Math.round(ratingAverage) || 7); }}
                  className="ml-2 px-3 py-1.5 rounded-lg bg-muted hover:opacity-90 text-xs transition-colors border border-border"
                >
                  Оценить
                </button>
              )}

              <div className="relative ml-auto" ref={menuRef}>
                <button className="px-3 py-2 bg-muted rounded-lg transition-colors border border-border hover:opacity-90" onClick={() => setMenuOpen((v) => !v)}>
                  <MoreHorizontal className="w-5 h-5" />
                </button>

                {menuOpen && (
                  <div className="absolute right-full mr-3 top-1/2 -translate-y-[63px] w-56 rounded-lg border border-border bg-card shadow-lg z-20 overflow-hidden">
                    {isGuest ? (
                      <div aria-disabled="true" className="block h-10 px-3 flex items-center text-sm text-muted-foreground opacity-70 cursor-not-allowed">
                        Сообщить об ошибке
                      </div>
                    ) : (
                      <Link href={`/title/${mid}/error`} className="block h-10 px-3 flex items-center text-sm hover:bg-muted transition">
                        Сообщить об ошибке
                      </Link>
                    )}
                    {isGuest ? (
                      <div aria-disabled="true" className="block h-10 px-3 flex items-center text-sm text-muted-foreground opacity-70 cursor-not-allowed">
                        Редактировать тайтл
                      </div>
                    ) : (
                      <Link href={`/title/${mid}/edit`} className="block h-10 px-3 flex items-center text-sm hover:bg-muted transition">
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
                  className={`pb-3 px-1 border-b-2 transition-colors ${tab === k ? 'border-accent text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                  {k === 'description' ? 'О тайтле' : k === 'chapters' ? 'Главы' : k === 'comments' ? 'Комментарии' : k === 'team' ? 'Команда' : 'Связанное'}
                </button>
              ))}
            </div>

            <div className="mt-4">
              {tab === 'description' && (
                <DescriptionInfo manga={manga} rawDesc={rawDesc} authors={authors} artists={artists} publishers={publishers} genres={genres} tags={tags} />
              )}

              {tab === 'chapters' && (
                <ChaptersPanel canEdit={canEdit} isLeader={isLeader} onAdded={reloadChapters} groups={chapterGroups} slugId={slugId} bookmark={bookmark} mid={mid} chapters={chapters} />
              )}

              <div className={tab === 'comments' ? 'block' : 'hidden'}>
                <CommentSection mangaId={mid} me={me ? { id: me.id, role: me.role ?? null } : null} canEdit={canEdit} leaderTeamId={me?.leaderTeamId ?? null} />
              </div>

              {tab === 'team' && (
                <div className="text-foreground/90">
                  <div className="space-y-4">
                    {teams.length === 0 && <p className="text-muted-foreground">Команды не привязаны</p>}
                    {teams.map((t) => (
                      <Link key={t.id} href={`/team/${t.slug ?? String(t.id)}`} className="block p-4 bg-card hover:bg-card/90 border border-border rounded-lg transition-colors">
                        <div className="flex items-center gap-3">
                          {t.avatar_url ? (
                            <img src={t.avatar_url} alt={t.name} className="w-12 h-12 rounded-full" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-foreground">{t.name[0]}</div>
                          )}
                          <div>
                            <div className="font-medium">{t.name}</div>
                            <div className="text-sm text-muted-foreground">Команда переводчиков</div>
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

          <div className="flex flex-col gap-4">
            <SidebarProgress bookmark={bookmark} chapters={chapters} slugId={slugId} firstChapterId={firstChapterId} />

            <div className="rounded-xl p-4 bg-card border border-border">
              <h3 className="text-sm font-medium mb-3">Обновления</h3>
              <div className="space-y-3 text-sm">
                {chapters.slice(0, 3).map((ch) => (
                  <div key={ch.id} className="flex justify-between items-center">
                    <span className="text-foreground/90">Глава {ch.chapter_number}</span>
                    <span className="text-muted-foreground text-xs">{new Date(ch.created_at).toLocaleDateString('ru-RU')}</span>
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