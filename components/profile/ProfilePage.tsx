// components/profile/ProfilePage.tsx
'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';

import { Header } from '@/components/Header';
import { useTheme } from '@/lib/theme/context';
import { useAuth } from '@/components/auth/AuthProvider';

import ProfileBanner from './ProfileBanner';
import ProfileTabs from './ProfileTabs';
import ProfileStats from './ProfileStats';
import type { CardItem, LibraryRow, ProfileLite, EditValues } from './types';

const EditProfileModal = dynamic(() => import('./EditProfileModal'), { ssr: false });
const AddTitleModal = dynamic(() => import('@/components/add-title/AddTitleModal'), { ssr: false });

const LOADING_GIF_SRC = '/images/profile-loading.gif';

/* ==================== API HELPERS ==================== */
/**
 * ✅ ЕДИНСТВЕННАЯ функция для загрузки профиля
 * Убрана двойная загрузка API
 */
async function fetchProfile(username: string): Promise<ProfileLite | null> {
  try {
    const response = await fetch(
      `/api/profile/by-username?u=${encodeURIComponent(username)}`,
      { cache: 'no-store' }
    );

    if (!response.ok) return null;

    const data = await response.json();
    
    // ✅ Проверяем новый формат { ok, data: { profile } }
    if (!data?.ok || !data?.data?.profile) return null;

    const p = data.data.profile;

    return {
      id: String(p.id),
      username: p.username || username,
      display_name: p.display_name ?? null,
      avatar_url: p.avatar_url ?? null,
      bio: p.bio ?? null,
      created_at: p.created_at ?? null,
      banner_url: p.banner_url ?? null,
      favorite_genres: Array.isArray(p.favorite_genres) ? p.favorite_genres : null,
      telegram: p.telegram ?? null,
      x_url: p.x_url ?? null,
      vk_url: p.vk_url ?? null,
      discord_url: p.discord_url ?? null,
    };
  } catch (error) {
    console.error('[fetchProfile] Error:', error);
    return null;
  }
}

/**
 * ✅ ЕДИНСТВЕННАЯ функция для загрузки библиотеки
 */
async function fetchLibrary(username: string): Promise<LibraryRow[]> {
  try {
    const response = await fetch(
      `/api/user-library?username=${encodeURIComponent(username)}`,
      { cache: 'no-store' }
    );

    if (!response.ok) return [];

    const data = await response.json();
    
    return Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
  } catch (error) {
    console.error('[fetchLibrary] Error:', error);
    return [];
  }
}

/* ==================== COMPONENT ==================== */
export default function ProfilePage() {
  const { handle } = useParams<{ handle: string }>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileLite | null>(null);

  // Library states
  const [reading, setReading] = useState<CardItem[]>([]);
  const [completed, setCompleted] = useState<CardItem[]>([]);
  const [favorites, setFavorites] = useState<CardItem[]>([]);
  const [planned, setPlanned] = useState<CardItem[]>([]);
  const [dropped, setDropped] = useState<CardItem[]>([]);
  const [libIndex, setLibIndex] = useState<Map<number, LibraryRow>>(new Map());

  // Modal states
  const [addTitleModalOpen, setAddTitleModalOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // ✅ Проверка владельца профиля
  const isOwnProfile = useMemo(() => {
    return !!user && !!profile && String(user.id) === String(profile.id);
  }, [user, profile]);

  // ✅ Начальные значения для редактирования
  const initialEditValues = useMemo<EditValues>(() => ({
    username: profile?.username ?? '',
    display_name: profile?.display_name ?? '',
    avatar_url: profile?.avatar_url ?? '',
    bio: profile?.bio ?? '',
    banner_url: profile?.banner_url ?? '',
    favorite_genres: profile?.favorite_genres ?? [],
    telegram: profile?.telegram ?? '',
    x_url: profile?.x_url ?? '',
    vk_url: profile?.vk_url ?? '',
    discord_url: profile?.discord_url ?? '',
  }), [profile]);

  // ✅ Получение статуса манги
  const getStatus = useCallback(
    (id: number) => libIndex.get(id)?.status ?? 'reading',
    [libIndex]
  );

  /* ==================== LOAD DATA ==================== */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!handle) return;

      setLoading(true);

      try {
        // ✅ Параллельная загрузка профиля и библиотеки
        const [profileData, libraryData] = await Promise.all([
          fetchProfile(String(handle)),
          fetchLibrary(String(handle)),
        ]);

        if (cancelled) return;

        if (!profileData) {
          // Профиль не найден
          setProfile(null);
          setReading([]);
          setCompleted([]);
          setFavorites([]);
          setPlanned([]);
          setDropped([]);
          setLibIndex(new Map());
          setLoading(false);
          return;
        }

        setProfile(profileData);

        // ✅ Обработка библиотеки
        const index = new Map<number, LibraryRow>();
        const readingList: CardItem[] = [];
        const completedList: CardItem[] = [];
        const plannedList: CardItem[] = [];
        const droppedList: CardItem[] = [];
        const favoritesList: CardItem[] = [];

        for (const row of libraryData) {
          const mangaId = Number(row.manga_id);
          index.set(mangaId, row);

          const item: CardItem = {
            manga_id: mangaId,
            title: row.manga?.title ?? null,
            cover_url: row.manga?.cover_url ?? null,
            lang: 'ru',
          };

          // Распределяем по спискам
          switch (row.status) {
            case 'reading':
              readingList.push(item);
              break;
            case 'completed':
              completedList.push(item);
              break;
            case 'planned':
              plannedList.push(item);
              break;
            case 'dropped':
              droppedList.push(item);
              break;
          }

          // Favorites
          const isFavorite = 
            typeof row.is_favorite === 'boolean' ? row.is_favorite : !!row.favorite;
          if (isFavorite) {
            favoritesList.push(item);
          }
        }

        if (cancelled) return;

        setLibIndex(index);
        setReading(readingList);
        setCompleted(completedList);
        setPlanned(plannedList);
        setDropped(droppedList);
        setFavorites(favoritesList);

      } catch (error) {
        console.error('[ProfilePage] Load error:', error);
        if (!cancelled) {
          setProfile(null);
          setReading([]);
          setCompleted([]);
          setFavorites([]);
          setPlanned([]);
          setDropped([]);
          setLibIndex(new Map());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [handle]);

  /* ==================== LIBRARY MUTATIONS ==================== */
  const upsertLibrary = async (
    mangaId: number,
    patch: Partial<{ status: 'reading' | 'completed' | 'planned' | 'dropped'; favorite: boolean }>
  ) => {
    if (!isOwnProfile) {
      console.warn('[upsertLibrary] Cannot edit another user library');
      return;
    }

    try {
      await fetch(`/api/manga/${mangaId}/library`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: patch.status, favorite: patch.favorite }),
      });
    } catch (error) {
      console.error('[upsertLibrary] Error:', error);
    }
  };

  const setStatus = async (
    item: CardItem,
    status: 'reading' | 'completed' | 'planned' | 'dropped'
  ) => {
    if (!isOwnProfile) {
      alert('Вы не можете редактировать чужую библиотеку');
      return;
    }

    // ✅ Оптимистичное обновление UI
    setReading((prev) =>
      status === 'reading'
        ? [item, ...prev.filter((x) => x.manga_id !== item.manga_id)]
        : prev.filter((x) => x.manga_id !== item.manga_id)
    );
    setCompleted((prev) =>
      status === 'completed'
        ? [item, ...prev.filter((x) => x.manga_id !== item.manga_id)]
        : prev.filter((x) => x.manga_id !== item.manga_id)
    );
    setPlanned((prev) =>
      status === 'planned'
        ? [item, ...prev.filter((x) => x.manga_id !== item.manga_id)]
        : prev.filter((x) => x.manga_id !== item.manga_id)
    );
    setDropped((prev) =>
      status === 'dropped'
        ? [item, ...prev.filter((x) => x.manga_id !== item.manga_id)]
        : prev.filter((x) => x.manga_id !== item.manga_id)
    );

    setLibIndex((map) => {
      const next = new Map(map);
      const current = next.get(item.manga_id) ?? {
        manga_id: item.manga_id,
        status: 'reading',
        is_favorite: false,
      } as LibraryRow;
      next.set(item.manga_id, { ...current, status });
      return next;
    });

    // API call
    await upsertLibrary(item.manga_id, { status });
  };

  const removeFromLibrary = async (item: CardItem) => {
    if (!isOwnProfile) {
      alert('Вы не можете редактировать чужую библиотеку');
      return;
    }

    // ✅ Оптимистичное удаление
    setReading((prev) => prev.filter((x) => x.manga_id !== item.manga_id));
    setCompleted((prev) => prev.filter((x) => x.manga_id !== item.manga_id));
    setPlanned((prev) => prev.filter((x) => x.manga_id !== item.manga_id));
    setDropped((prev) => prev.filter((x) => x.manga_id !== item.manga_id));
    setFavorites((prev) => prev.filter((x) => x.manga_id !== item.manga_id));
    setLibIndex((map) => {
      const next = new Map(map);
      next.delete(item.manga_id);
      return next;
    });

    // API call
    try {
      await fetch(`/api/manga/${item.manga_id}/library`, {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch (error) {
      console.error('[removeFromLibrary] Error:', error);
    }
  };

  /* ==================== PROFILE UPDATE ==================== */
  const handleProfileSaved = async (values: EditValues) => {
    // ✅ Перезагружаем профиль после сохранения
    const updatedProfile = await fetchProfile(values.username);
    if (updatedProfile) {
      setProfile(updatedProfile);
    }

    // ✅ Редирект если изменился username
    if (values.username && values.username !== profile?.username) {
      router.replace(`/profile/${values.username}`);
    }
  };

  /* ==================== RENDER ==================== */
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
              <img
                src={LOADING_GIF_SRC}
                alt="Загрузка…"
                className="block w-36 h-36 md:w-52 md:h-52 object-cover select-none"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
            <p className="text-muted-foreground">Загрузка профиля…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background text-foreground relative">
        <div className="fixed inset-0 pointer-events-none opacity-20">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-foreground/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-foreground/5 rounded-full blur-3xl" />
        </div>

        <Header showSearch={false} />
        <div className="relative max-w-[1400px] mx-auto px-6 py-12">
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🥺👉👈</div>
            <h1 className="text-2xl font-bold mb-2">Профиль не найден</h1>
            <p className="text-muted-foreground mb-6">
              Пользователь @{handle} не существует или был удалён
            </p>
            <a
              href="/"
              className="inline-block px-6 py-3 rounded-xl bg-muted border border-border hover:opacity-90 transition-colors"
            >
              Вернуться на главную
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-foreground/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-foreground/5 rounded-full blur-3xl" />
      </div>

      <Header showSearch={false} />

      <div className="relative mx-auto max-w-[1400px] px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-8 space-y-6">
            <ProfileBanner
              profile={profile}
              canEdit={isOwnProfile}
              onEdit={() => setEditOpen(true)}
            />

            {profile.bio && (
              <section className="rounded-2xl p-6 bg-card/80 backdrop-blur-sm border border-border/50">
                <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
                  О себе
                </h2>
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                  {profile.bio}
                </p>
              </section>
            )}

            <section>
              <ProfileTabs
                theme={theme === 'light' ? 'light' : 'dark'}
                reading={reading}
                completed={completed}
                planned={planned}
                dropped={dropped}
                favorites={favorites}
                getStatus={(id) => getStatus(id)}
                onSetStatus={(item, s) => setStatus(item, s)}
                onRemove={removeFromLibrary}
                editable={isOwnProfile}
              />
            </section>
          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-4">
            <ProfileStats
              completed={completed.length}
              reading={reading.length}
              planned={planned.length}
              dropped={dropped.length}
              favorites={favorites.length}
              createdAt={profile.created_at}
              favoriteGenres={profile.favorite_genres}
              profile={profile}
            />
          </aside>
        </div>
      </div>

      {/* Modals */}
      <AddTitleModal
        open={addTitleModalOpen}
        onOpenChange={setAddTitleModalOpen}
        onSuccess={() => setAddTitleModalOpen(false)}
      />

      {isOwnProfile && (
        <EditProfileModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          initial={initialEditValues}
          onSaved={handleProfileSaved}
          profileId={profile.id}
        />
      )}
    </div>
  );
}