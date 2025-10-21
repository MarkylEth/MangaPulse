// components/profile/ProfilePage.tsx
'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';

import { Header } from '@/components/Header';
import { useTheme } from '@/lib/theme/context';
import { useAuth } from '@/components/auth/AuthProvider';
import { tryJson } from '@/lib/utils'; 

import ProfileBanner from './ProfileBanner';
import ProfileTabs from './ProfileTabs';
import ProfileStats from './ProfileStats';
import type { CardItem, ActivityItem, LibraryRow, ProfileLite, EditValues } from './types';

// ленивые модалки
const EditProfileModal = dynamic(() => import('./EditProfileModal'), { ssr: false });
const AddTitleModal   = dynamic(() => import('@/components/add-title/AddTitleModal'), { ssr: false });

/* ================= helpers ================= */

const LOADING_GIF_SRC = '/images/profile-loading.gif'; // положи гифку в public/images/

function normalizeProfile(raw: any, fallbackUsername: string): ProfileLite | null {
  // ✅ Теперь все API возвращают { ok, data: { profile } }
  if (!raw?.ok || !raw?.data) return null;
  
  const profile = raw.data.profile;
  if (!profile?.id) return null;

  // ✅ Простая нормализация
  return {
    id: String(profile.id),
    username: profile.username || fallbackUsername,
    full_name: profile.full_name ?? null,
    avatar_url: profile.avatar_url ?? null,
    bio: profile.bio ?? null,
    created_at: profile.created_at ?? null,
    banner_url: profile.banner_url ?? null,
    favorite_genres: Array.isArray(profile.favorite_genres) 
      ? profile.favorite_genres 
      : null,
    telegram: profile.telegram ?? null,
    x_url: profile.x_url ?? null,
    vk_url: profile.vk_url ?? null,
    discord_url: profile.discord_url ?? null,
  };
}

/* ================= страница ================= */

export default function ProfilePage() {
  const { handle } = useParams<{ handle: string }>();
  const { theme } = useTheme();
  const { user } = useAuth() as { user?: any; loading?: boolean };
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileLite | null>(null);

  const [reading, setReading] = useState<CardItem[]>([]);
  const [completed, setCompleted] = useState<CardItem[]>([]);
  const [favorites, setFavorites] = useState<CardItem[]>([]);
  const [planned, setPlanned] = useState<CardItem[]>([]);
  const [dropped, setDropped] = useState<CardItem[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);

  const [libIndex, setLibIndex] = useState<Map<number, LibraryRow>>(new Map());

  const [addTitleModalOpen, setAddTitleModalOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const initialEditValues = useMemo<EditValues>(() => ({
    username: profile?.username ?? '',
    full_name: profile?.full_name ?? '',
    avatar_url: profile?.avatar_url ?? '',
    bio: profile?.bio ?? '',
    banner_url: profile?.banner_url ?? '',
    favorite_genres: profile?.favorite_genres ?? [],
    telegram: profile?.telegram ?? '',
    x_url: profile?.x_url ?? '',
    vk_url: profile?.vk_url ?? '',
    discord_url: profile?.discord_url ?? '',
  }), [profile]);

  const getStatus = useCallback((id: number) => libIndex.get(id)?.status ?? 'reading', [libIndex]);

  const isOwnProfile = useMemo(() => {
    return !!user && !!profile && String(user.id) === String(profile.id);
  }, [user, profile]);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!handle) return;
      setLoading(true);

      try {
        const profRaw = await tryJson([
          `/api/profile/by-username?u=${encodeURIComponent(String(handle))}`,
          `/api/profile/${encodeURIComponent(String(handle))}`,
        ]);

        const p = normalizeProfile(profRaw, String(handle));

        if (!p?.id) {
          setProfile(null);
          setReading([]);
          setCompleted([]);
          setFavorites([]);
          setPlanned([]);
          setDropped([]);
          setRecentActivity([]);
          setLibIndex(new Map());
          setLoading(false);
          return;
        }

        setProfile(p);

        const usernameParam = encodeURIComponent(String(p.username || handle));
        const libRes = await tryJson([`/api/user-library?username=${usernameParam}`]);

        const rows: LibraryRow[] = Array.isArray(libRes)
          ? libRes
          : Array.isArray((libRes as any)?.data)
            ? (libRes as any).data
            : [];

        const idx = new Map<number, LibraryRow>();
        for (const r of rows) idx.set(Number(r.manga_id), r as LibraryRow);
        setLibIndex(idx);

        const toItem = (r: LibraryRow): CardItem => ({
          manga_id: Number(r.manga_id),
          title: r.manga?.title ?? null,
          cover_url: r.manga?.cover_url ?? null,
          lang: 'ru',
        });

        setReading(rows.filter(r => r.status === 'reading').map(toItem));
        setCompleted(rows.filter(r => r.status === 'completed').map(toItem));
        setPlanned(rows.filter(r => r.status === 'planned').map(toItem));
        setDropped(rows.filter(r => r.status === 'dropped').map(toItem));
        setFavorites(
          rows
            .filter(r => (typeof r.is_favorite === 'boolean' ? r.is_favorite : !!r.favorite))
            .map(toItem)
        );

        setRecentActivity(
          rows.slice(0, 5).map(r => ({
            type: r.status === 'completed' ? 'completed'
                : r.status === 'planned'   ? 'planned'
                : r.status === 'dropped'   ? 'dropped'
                : 'read',
            manga_id: Number(r.manga_id),
            manga_title: r.manga?.title ?? 'Без названия',
            manga_cover: r.manga?.cover_url ?? null,
            date: r.updated_at || r.created_at || new Date().toISOString(),
          }))
        );
      } catch (e) {
        console.error('[ProfilePage] load failed', e);
        setProfile(null);
        setReading([]);
        setCompleted([]);
        setFavorites([]);
        setPlanned([]);
        setDropped([]);
        setRecentActivity([]);
        setLibIndex(new Map());
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [handle]);

  const upsertLibrary = async (
    mangaId: number,
    patch: Partial<{ status: 'reading'|'completed'|'planned'|'dropped'; favorite: boolean }>
  ) => {
    if (!isOwnProfile) {
      console.warn('[upsertLibrary] Cannot edit another user library');
      return;
    }

    await fetch(`/api/manga/${mangaId}/library`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: patch.status, favorite: patch.favorite }),
    }).catch(() => {});
  };

  const setStatus = async (item: CardItem, status: 'reading'|'completed'|'planned'|'dropped') => {
    if (!isOwnProfile) {
      alert('Вы не можете редактировать чужую библиотеку');
      return;
    }

    setReading((p)   => status === 'reading'   ? [item, ...p.filter(x => x.manga_id !== item.manga_id)] : p.filter(x => x.manga_id !== item.manga_id));
    setCompleted((p) => status === 'completed' ? [item, ...p.filter(x => x.manga_id !== item.manga_id)] : p.filter(x => x.manga_id !== item.manga_id));
    setPlanned((p)   => status === 'planned'   ? [item, ...p.filter(x => x.manga_id !== item.manga_id)] : p.filter(x => x.manga_id !== item.manga_id));
    setDropped((p)   => status === 'dropped'   ? [item, ...p.filter(x => x.manga_id !== item.manga_id)] : p.filter(x => x.manga_id !== item.manga_id));

    setLibIndex((m) => {
      const next = new Map(m);
      const cur = next.get(item.manga_id) ?? { manga_id: item.manga_id, status: 'reading', is_favorite: false } as LibraryRow;
      next.set(item.manga_id, { ...cur, status });
      return next;
    });

    await upsertLibrary(item.manga_id, { status });
  };

  const removeFromLibrary = async (item: CardItem) => {
    if (!isOwnProfile) {
      alert('Вы не можете редактировать чужую библиотеку');
      return;
    }

    setReading(p => p.filter(x => x.manga_id !== item.manga_id));
    setCompleted(p => p.filter(x => x.manga_id !== item.manga_id));
    setPlanned(p => p.filter(x => x.manga_id !== item.manga_id));
    setDropped(p => p.filter(x => x.manga_id !== item.manga_id));
    setFavorites(p => p.filter(x => x.manga_id !== item.manga_id));
    setLibIndex(m => { const n = new Map(m); n.delete(item.manga_id); return n; });

    await fetch(`/api/manga/${item.manga_id}/library`, {
      method: 'DELETE',
      credentials: 'include',
    }).catch(() => {});
  };

  /* ============ рендер ============ */
  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground relative">
        {/* Ambient blobs */}
        <div className="fixed inset-0 pointer-events-none opacity-20">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-foreground/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-foreground/5 rounded-full blur-3xl" />
        </div>
  
        <Header showSearch={false} />
  
        {/* Центр: БОЛЬШАЯ гифка + подпись */}
        <div className="relative max-w-[1400px] mx-auto px-6 py-12">
          <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
            <div className="rounded-2xl overflow-hidden ring-1 ring-border/40 shadow-lg">
              <img
                src={LOADING_GIF_SRC}
                alt="Загрузка…"
                className="block w-36 h-36 md:w-52 md:h-52 object-cover select-none"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
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
      {/* Ambient background effect */}
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-foreground/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-foreground/5 rounded-full blur-3xl" />
      </div>

      <Header showSearch={false} />

      <div className="relative mx-auto max-w-[1400px] px-6 py-8">
        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Banner */}
          <div className="lg:col-span-8 space-y-6">
            <ProfileBanner
              profile={profile}
              canEdit={isOwnProfile}
              onEdit={() => setEditOpen(true)}
            />

            {/* Bio Section */}
            {profile.bio && (
              <section className="rounded-2xl p-6 bg-card/80 backdrop-blur-sm border border-border/50">
                <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">О себе</h2>
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                  {profile.bio}
                </p>
              </section>
            )}

            {/* Library Tabs */}
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

          {/* Right: Stats Sidebar */}
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
          onSaved={(v) => {
            (async () => {
              const profRaw = await tryJson([
                `/api/profile/by-username?u=${encodeURIComponent(v.username)}`,
              ]);
              const p = normalizeProfile(profRaw, v.username);
              if (p) setProfile(p);
            })();

            if (v.username && v.username !== profile?.username) {
              router.replace(`/profile/${v.username}`);
            }
          }}
          profileId={profile.id}
        />
      )}
    </div>
  );
}
