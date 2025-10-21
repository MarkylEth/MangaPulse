'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Filter, Users, Crown, Shield, UserCheck, Settings, X, Save, Check,
  Ban as BanIcon, Mail, Clock3, Loader2, BadgeCheck, Link as LinkIcon, LogOut,
  Image as ImageIcon, Globe, MessageSquare, Hash, User as UserIcon,
} from 'lucide-react';

type Role = 'admin' | 'moderator' | 'user';

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  role: Role | null;
  avatar_url: string | null;
  created_at: string;
  banned?: boolean;
  email?: string | null;
  note?: string | null;
  // Дополнительные поля
  bio?: string | null;
  banner_url?: string | null;
  about_md?: string | null;
  favorite_genres?: string[] | null;
  social_links?: Record<string, any> | null;
  telegram?: string | null;
  discord_url?: string | null;
  vk_url?: string | null;
  x_url?: string | null;
  display_name?: string | null;
  nickname?: string | null;
};

type UserDetails = {
  profile: Profile;
  approvals?: Array<{ id: string; type: string; status: string; created_at: string; title?: string }>;
  lastActivity?: Array<{ id: string; kind: string; when: string; meta?: string }>;
};

export default function UserManagement() {
  // data
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all');

  // modal
  const [openId, setOpenId] = useState<string | null>(null);
  const [details, setDetails] = useState<UserDetails | null>(null);
  const [tab, setTab] = useState<'profile' | 'extended' | 'social' | 'access' | 'activity' | 'security'>('profile');
  const [saving, setSaving] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // drafts - основные поля
  const [draftProfile, setDraftProfile] = useState<Partial<Profile>>({
    username: '',
    full_name: '',
    email: '',
    note: '',
    display_name: '',
    nickname: '',
    bio: '',
    about_md: '',
    avatar_url: '',
    banner_url: '',
    telegram: '',
    discord_url: '',
    vk_url: '',
    x_url: '',
    favorite_genres: [],
    social_links: {},
  });
  const [draftRole, setDraftRole] = useState<Role>('user');
  const [draftBanned, setDraftBanned] = useState(false);

  // security
  const [secBusy, setSecBusy] = useState<{ revoke?: boolean; reset?: boolean }>({});
  const [resetLink, setResetLink] = useState<string | null>(null);

  // Design tokens
  const text = 'text-black dark:text-white';
  const muted = 'text-gray-700 dark:text-gray-400';
  const surface = 'bg-white dark:bg-[#1a1a1a]';
  const input =
    'w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-[#0f1115] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ' +
    text;
  const textarea =
    'w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-[#0f1115] px-3 py-2 text-sm min-h-[88px] resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ' +
    text;
  const btn =
    'rounded-lg border border-black/10 dark:border-white/10 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 px-3 py-2 text-sm ' +
    text;
  const btnPrimary =
    'rounded-lg bg-[#2b2f36] dark:bg-[#2b2f36] hover:bg-[#363b44] text-white px-3 py-2 text-sm transition-colors disabled:opacity-60';
  const chipBase = 'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs';

  const roleColors = {
    admin: {
      badge: 'border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300',
      selectActive: 'border-amber-400 dark:border-amber-500/60 bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300',
      dot: 'bg-amber-500',
    },
    moderator: {
      badge: 'border-sky-300 dark:border-sky-500/40 bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300',
      selectActive: 'border-sky-400 dark:border-sky-500/60 bg-sky-100 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300',
      dot: 'bg-sky-500',
    },
    user: {
      badge: 'border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      selectActive: 'border-emerald-400 dark:border-emerald-500/60 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      dot: 'bg-emerald-500',
    },
  } as const;

  async function fetchUsers() {
    setLoading(true);
    try {
      const url = new URL('/api/admin/users', window.location.origin);
      if (q) url.searchParams.set('q', q);
      if (roleFilter !== 'all') url.searchParams.set('role', roleFilter);
      const r = await fetch(url.toString(), { cache: 'no-store', headers: { 'x-admin': '1' } });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setUsers(j.items as Profile[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    const id = setTimeout(fetchUsers, 200);
    return () => clearTimeout(id);
  }, [q, roleFilter]);

  const filtered = useMemo(() => users, [users]);

  function RoleBadge({ role }: { role: Role | null }) {
    const rr = (role ?? 'user') as Role;
    const label = rr === 'admin' ? 'Админ' : rr === 'moderator' ? 'Модератор' : 'Пользователь';
    return (
      <span className={`${chipBase} ${roleColors[rr].badge}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${roleColors[rr].dot}`} />
        {label}
      </span>
    );
  }

  function StatusBadge({ banned }: { banned?: boolean }) {
    return banned ? (
      <span className="inline-flex items-center gap-1 rounded-md border border-red-300 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-2 py-1 text-xs text-red-700 dark:text-red-300">
        <BanIcon className="h-3.5 w-3.5" /> Заблокирован
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 text-xs text-emerald-700 dark:text-emerald-300">
        <Check className="h-3.5 w-3.5" /> Активен
      </span>
    );
  }

  function openModal(u: Profile) {
    setOpenId(u.id);
    setTab('profile');
    setDetails({ profile: u });
    setResetLink(null);
    setDraftProfile({
      username: u.username ?? '',
      full_name: u.full_name ?? '',
      email: u.email ?? '',
      note: u.note ?? '',
      display_name: u.display_name ?? '',
      nickname: u.nickname ?? '',
      bio: u.bio ?? '',
      about_md: u.about_md ?? '',
      avatar_url: u.avatar_url ?? '',
      banner_url: u.banner_url ?? '',
      telegram: u.telegram ?? '',
      discord_url: u.discord_url ?? '',
      vk_url: u.vk_url ?? '',
      x_url: u.x_url ?? '',
      favorite_genres: u.favorite_genres ?? [],
      social_links: u.social_links ?? {},
    });
    setDraftRole((u.role ?? 'user') as Role);
    setDraftBanned(!!u.banned);
    loadDetails(u.id);
  }

  function closeModal() {
    setOpenId(null);
    setDetails(null);
    setResetLink(null);
  }

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId]);

  async function loadDetails(id: string) {
    setLoadingDetails(true);
    try {
      const r = await fetch(`/api/admin/users/${id}?include=activity,approvals,profile`, {
        headers: { 'x-admin': '1' },
        cache: 'no-store',
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as { ok: boolean; data: UserDetails };
      if (j.ok && j.data) {
        setDetails(j.data);
        const p = j.data.profile;
        setDraftProfile({
          username: p.username ?? '',
          full_name: p.full_name ?? '',
          email: p.email ?? '',
          note: p.note ?? '',
          display_name: p.display_name ?? '',
          nickname: p.nickname ?? '',
          bio: p.bio ?? '',
          about_md: p.about_md ?? '',
          avatar_url: p.avatar_url ?? '',
          banner_url: p.banner_url ?? '',
          telegram: p.telegram ?? '',
          discord_url: p.discord_url ?? '',
          vk_url: p.vk_url ?? '',
          x_url: p.x_url ?? '',
          favorite_genres: p.favorite_genres ?? [],
          social_links: p.social_links ?? {},
        });
        setDraftRole((p.role ?? 'user') as Role);
        setDraftBanned(!!p.banned);
      }
    } catch (e) {
      console.warn('details load:', e);
    } finally {
      setLoadingDetails(false);
    }
  }

  async function saveAll() {
    if (!details) return;
    setSaving(true);
    try {
      const id = details.profile.id;

      // профиль (все поля)
      const r1 = await fetch('/api/admin/users/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin': '1' },
        body: JSON.stringify({ id, ...draftProfile }),
      });
      const j1 = await r1.json();
      if (!r1.ok || !j1?.ok) throw new Error(j1?.error || `HTTP ${r1.status}`);

      // роль
      if (details.profile.role !== draftRole) {
        const r2 = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin': '1' },
          body: JSON.stringify({ id, role: draftRole }),
        });
        const j2 = await r2.json();
        if (!r2.ok || !j2?.ok) throw new Error(j2?.error || `HTTP ${r2.status}`);
      }

      // бан
      if (!!details.profile.banned !== draftBanned) {
        const reason = draftBanned ? prompt('Причина блокировки (необязательно):') ?? '' : '';
        const r3 = await fetch('/api/admin/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-admin': '1' },
          body: JSON.stringify({ id, banned: draftBanned, reason }),
        });
        const j3 = await r3.json();
        if (!r3.ok || !j3?.ok) throw new Error(j3?.error || `HTTP ${r3.status}`);
      }

      // локально
      setUsers((prev) =>
        prev.map((u) =>
          u.id === details.profile.id ? { ...u, ...draftProfile, role: draftRole, banned: draftBanned } : u
        )
      );
      setDetails((d) =>
        d ? { ...d, profile: { ...d.profile, ...draftProfile, role: draftRole, banned: draftBanned } } : d
      );

      alert('✅ Сохранено успешно!');
    } catch (e) {
      alert('❌ Ошибка: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function revokeSessions() {
    if (!details) return;
    setSecBusy((s) => ({ ...s, revoke: true }));
    try {
      const r = await fetch('/api/admin/users/security/revoke-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin': '1' },
        body: JSON.stringify({ id: details.profile.id }),
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      alert(`Завершено сеансов: ${j.revoked ?? 0}`);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSecBusy((s) => ({ ...s, revoke: false }));
    }
  }

  async function createResetLink() {
    if (!details) return;
    setSecBusy((s) => ({ ...s, reset: true }));
    try {
      const r = await fetch('/api/admin/users/security/create-reset-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin': '1' },
        body: JSON.stringify({ id: details.profile.id, ttl_minutes: 60 * 24 }),
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setResetLink(j.url);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSecBusy((s) => ({ ...s, reset: false }));
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          <span className={muted}>Загрузка…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-col gap-2">
        <h1 className={`text-3xl font-semibold tracking-tight ${text}`}>Пользователи</h1>
        <p className={muted}>Клик по строке откроет модалку</p>
      </div>

      {/* stats */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {[
          { title: 'Всего', value: users.length, icon: Users },
          { title: 'Админов', value: users.filter((u) => u.role === 'admin').length, icon: Crown },
          { title: 'Модераторов', value: users.filter((u) => u.role === 'moderator').length, icon: Shield },
          { title: 'Активных', value: users.filter((u) => !u.banned).length, icon: UserCheck },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`rounded-xl p-4 ${surface} border border-black/10 dark:border-white/10`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-2xl font-semibold ${text}`}>{s.value}</div>
                  <div className={`text-xs ${muted}`}>{s.title}</div>
                </div>
                <div className="rounded-lg bg-gray-100 p-2 dark:bg-white/10">
                  <Icon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* toolbar */}
      <div className={`rounded-xl p-4 ${surface} border border-black/10 dark:border-white/10`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className={`absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 ${muted}`} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск по имени, email или id…"
              className={`${input} pl-10`}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className={`h-5 w-5 ${muted}`} />
            <div className="grid grid-cols-4 overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
              {[
                { key: 'all', label: 'Все' },
                { key: 'user', label: 'User' },
                { key: 'moderator', label: 'Mod' },
                { key: 'admin', label: 'Admin' },
              ].map((o) => (
                <button
                  key={o.key}
                  onClick={() => setRoleFilter(o.key as any)}
                  className={`px-3 py-2 text-sm transition-colors ${
                    roleFilter === (o.key as any)
                      ? 'bg-gray-100 dark:bg-white/10 ' + text
                      : 'bg-transparent hover:bg-gray-100 dark:hover:bg-white/10 ' + muted
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* table */}
      <div className={`overflow-hidden rounded-xl ${surface} border border-black/10 dark:border-white/10`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 dark:bg-white/5 text-xs uppercase tracking-wide">
              <tr>
                <th className={`px-6 py-3 text-left ${muted}`}>Пользователь</th>
                <th className={`px-6 py-3 text-left ${muted}`}>Роль</th>
                <th className={`px-6 py-3 text-left ${muted}`}>Статус</th>
                <th className={`px-6 py-3 text-left ${muted}`}>Регистрация</th>
                <th className={`px-6 py-3 text-right ${muted}`}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10 dark:divide-white/10">
              {filtered.map((u) => (
                <tr
                  key={u.id}
                  className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
                  onClick={() => openModal(u)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-gray-100 text-sm font-semibold text-gray-700 dark:border-white/10 dark:bg-white/10 dark:text-gray-200">
                        {(u.username?.[0] || u.full_name?.[0] || 'U').toUpperCase()}
                      </div>
                      <div>
                        <div className={`font-medium ${text}`}>{u.username || u.full_name || 'Без имени'}</div>
                        <div className={`text-xs ${muted}`}>{u.id.slice(0, 8)}…</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge banned={u.banned} />
                  </td>
                  <td className="px-6 py-4">
                    <div className={`text-sm ${muted}`}>
                      {new Date(u.created_at).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end">
                      <button
                        className={btn}
                        onClick={(e) => {
                          e.stopPropagation();
                          openModal(u);
                        }}
                      >
                        <Settings className="mr-2 h-4 w-4 inline" />
                        Управлять
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className={`px-6 py-10 text-center ${muted}`}>
                    Ничего не найдено
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL */}
      <AnimatePresence>
        {openId && details && (
          <div className="fixed inset-0 z-50">
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
            />
            <div className="absolute inset-0 grid place-items-center p-4">
              <motion.div
                className="w-[min(980px,92vw)]"
                initial={{ opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 14, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className={`rounded-2xl ${surface} border border-black/10 dark:border-white/10 shadow-[0_20px_80px_rgba(0,0,0,.6)] max-h-[85vh] flex flex-col`}
                >
                  {/* header */}
                  <div className="flex items-center justify-between p-4 border-b border-black/10 dark:border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-gray-100 text-sm font-semibold text-gray-700 dark:border-white/10 dark:bg-white/10 dark:text-gray-200">
                        {(details.profile.username?.[0] || details.profile.full_name?.[0] || 'U').toUpperCase()}
                      </div>
                      <div>
                        <div className={`font-medium ${text}`}>
                          {details.profile.username || details.profile.full_name || 'Без имени'}
                        </div>
                        <div className={`flex items-center gap-3 text-xs ${muted}`}>
                          <span className="inline-flex items-center gap-1">
                            <Mail className="h-3.5 w-3.5" />
                            {details.profile.email || '—'}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <BadgeCheck className="h-3.5 w-3.5" />
                            ID: {details.profile.id}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button className={btn} onClick={closeModal} aria-label="Закрыть">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* tabs */}
                  <div className="flex items-center gap-2 px-4 pt-3 overflow-x-auto">
                    {[
                      { k: 'profile', label: 'Основное', icon: UserIcon },
                      { k: 'extended', label: 'Расширенное', icon: Hash },
                      { k: 'social', label: 'Соц. сети', icon: Globe },
                      { k: 'access', label: 'Роли', icon: Shield },
                      { k: 'activity', label: 'Активность', icon: Clock3 },
                      { k: 'security', label: 'Безопасность', icon: BadgeCheck },
                    ].map((t) => {
                      const Icon = t.icon;
                      return (
                        <button
                          key={t.k}
                          onClick={() => setTab(t.k as any)}
                          className={`rounded-lg px-3 py-2 text-sm transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                            tab === (t.k as any)
                              ? 'bg-gray-100 dark:bg-white/10 ' + text
                              : 'hover:bg-gray-100 dark:hover:bg-white/10 ' + muted
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {t.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* content */}
                  <div className="px-4 pb-4 overflow-y-auto">
                    {loadingDetails && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                        <Loader2 className="h-4 w-4 animate-spin" /> догружаем детали…
                      </div>
                    )}

                    {/* PROFILE - основное */}
                    {tab === 'profile' && (
                      <div className="grid grid-cols-1 gap-4 pt-4 md:grid-cols-2">
                        <div>
                          <label className={`mb-1 block text-xs uppercase ${muted}`}>Username</label>
                          <input
                            className={input}
                            value={draftProfile.username ?? ''}
                            onChange={(e) => setDraftProfile((p) => ({ ...p, username: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className={`mb-1 block text-xs uppercase ${muted}`}>Полное имя</label>
                          <input
                            className={input}
                            value={draftProfile.full_name ?? ''}
                            onChange={(e) => setDraftProfile((p) => ({ ...p, full_name: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className={`mb-1 block text-xs uppercase ${muted}`}>Display Name</label>
                          <input
                            className={input}
                            value={draftProfile.display_name ?? ''}
                            onChange={(e) => setDraftProfile((p) => ({ ...p, display_name: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className={`mb-1 block text-xs uppercase ${muted}`}>Nickname</label>
                          <input
                            className={input}
                            value={draftProfile.nickname ?? ''}
                            onChange={(e) => setDraftProfile((p) => ({ ...p, nickname: e.target.value }))}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className={`mb-1 block text-xs uppercase ${muted}`}>Email</label>
                          <input
                            className={input}
                            type="email"
                            value={draftProfile.email ?? ''}
                            onChange={(e) => setDraftProfile((p) => ({ ...p, email: e.target.value }))}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className={`mb-1 block text-xs uppercase ${muted}`}>Заметка (для модерации)</label>
                          <textarea
                            className={textarea}
                            value={draftProfile.note ?? ''}
                            onChange={(e) => setDraftProfile((p) => ({ ...p, note: e.target.value }))}
                            placeholder="Внутренняя заметка об этом пользователе"
                          />
                        </div>
                      </div>
                    )}

                    {/* EXTENDED - расширенное */}
                    {tab === 'extended' && (
                      <div className="grid grid-cols-1 gap-4 pt-4">
                        <div>
                          <label className={`mb-1 flex items-center gap-2 text-xs uppercase ${muted}`}>
                            <ImageIcon className="h-3.5 w-3.5" />
                            Avatar URL
                          </label>
                          <input
                            className={input}
                            value={draftProfile.avatar_url ?? ''}
                            onChange={(e) => setDraftProfile((p) => ({ ...p, avatar_url: e.target.value }))}
                            placeholder="https://example.com/avatar.jpg"
                          />
                        </div>
                        <div>
                          <label className={`mb-1 flex items-center gap-2 text-xs uppercase ${muted}`}>
                            <ImageIcon className="h-3.5 w-3.5" />
                            Banner URL
                          </label>
                          <input
                            className={input}
                            value={draftProfile.banner_url ?? ''}
                            onChange={(e) => setDraftProfile((p) => ({ ...p, banner_url: e.target.value }))}
                            placeholder="https://example.com/banner.jpg"
                          />
                        </div>
                        <div>
                          <label className={`mb-1 block text-xs uppercase ${muted}`}>Bio (краткое)</label>
                          <textarea
                            className={textarea}
                            value={draftProfile.bio ?? ''}
                            onChange={(e) => setDraftProfile((p) => ({ ...p, bio: e.target.value }))}
                            placeholder="Краткая биография пользователя"
                            rows={3}
                          />
                        </div>
                        <div>
                          <label className={`mb-1 block text-xs uppercase ${muted}`}>About (Markdown)</label>
                          <textarea
                            className={textarea + ' min-h-[140px]'}
                            value={draftProfile.about_md ?? ''}
                            onChange={(e) => setDraftProfile((p) => ({ ...p, about_md: e.target.value }))}
                            placeholder="Полное описание в формате Markdown"
                            rows={6}
                          />
                        </div>
                        <div>
                          <label className={`mb-1 block text-xs uppercase ${muted}`}>
                            Любимые жанры (через запятую)
                          </label>
                          <input
                            className={input}
                            value={Array.isArray(draftProfile.favorite_genres) ? draftProfile.favorite_genres.join(', ') : ''}
                            onChange={(e) =>
                              setDraftProfile((p) => ({
                                ...p,
                                favorite_genres: e.target.value.split(',').map((g) => g.trim()).filter(Boolean),
                              }))
                            }
                            placeholder="action, comedy, drama"
                          />
                        </div>
                      </div>
                    )}

                    {/* SOCIAL - соц. сети */}
                    {tab === 'social' && (
                      <div className="grid grid-cols-1 gap-4 pt-4 md:grid-cols-2">
                        <div>
                          <label className={`mb-1 flex items-center gap-2 text-xs uppercase ${muted}`}>
                            <MessageSquare className="h-3.5 w-3.5" />
                            Telegram
                          </label>
                          <input
                            className={input}
                            value={draftProfile.telegram ?? ''}
                            onChange={(e) => setDraftProfile((p) => ({ ...p, telegram: e.target.value }))}
                            placeholder="@username или t.me/username"
                          />
                        </div>
                        <div>
                          <label className={`mb-1 flex items-center gap-2 text-xs uppercase ${muted}`}>
                            <Globe className="h-3.5 w-3.5" />
                            Discord
                          </label>
                          <input
                            className={input}
                            value={draftProfile.discord_url ?? ''}
                            onChange={(e) => setDraftProfile((p) => ({ ...p, discord_url: e.target.value }))}
                            placeholder="https://discord.gg/..."
                          />
                        </div>
                        <div>
                          <label className={`mb-1 flex items-center gap-2 text-xs uppercase ${muted}`}>
                            <Globe className="h-3.5 w-3.5" />
                            VK
                          </label>
                          <input
                            className={input}
                            value={draftProfile.vk_url ?? ''}
                            onChange={(e) => setDraftProfile((p) => ({ ...p, vk_url: e.target.value }))}
                            placeholder="https://vk.com/..."
                          />
                        </div>
                        <div>
                          <label className={`mb-1 flex items-center gap-2 text-xs uppercase ${muted}`}>
                            <Globe className="h-3.5 w-3.5" />
                            X (Twitter)
                          </label>
                          <input
                            className={input}
                            value={draftProfile.x_url ?? ''}
                            onChange={(e) => setDraftProfile((p) => ({ ...p, x_url: e.target.value }))}
                            placeholder="https://x.com/..."
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className={`mb-1 block text-xs uppercase ${muted}`}>
                            Social Links (JSON)
                          </label>
                          <textarea
                            className={textarea}
                            value={JSON.stringify(draftProfile.social_links ?? {}, null, 2)}
                            onChange={(e) => {
                              try {
                                const parsed = JSON.parse(e.target.value);
                                setDraftProfile((p) => ({ ...p, social_links: parsed }));
                              } catch {
                                // игнорируем невалидный JSON
                              }
                            }}
                            placeholder='{"website": "https://example.com", "github": "username"}'
                            rows={4}
                          />
                          <div className={`mt-1 text-xs ${muted}`}>
                            Дополнительные ссылки в формате JSON
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ACCESS - роли и статус */}
                    {tab === 'access' && (
                      <div className="grid grid-cols-1 gap-4 pt-4">
                        <div>
                          <div className={`mb-2 text-xs uppercase ${muted}`}>Роль</div>
                          <div className="grid grid-cols-3 gap-2">
                            {(['user', 'moderator', 'admin'] as Role[]).map((r) => {
                              const active = draftRole === r;
                              return (
                                <button
                                  key={r}
                                  onClick={() => setDraftRole(r)}
                                  className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                                    active
                                      ? roleColors[r].selectActive
                                      : 'border-black/10 dark:border-white/10 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 ' +
                                        text
                                  }`}
                                >
                                  {r === 'user' ? 'Пользователь' : r === 'moderator' ? 'Модератор' : 'Админ'}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <div className={`mb-2 text-xs uppercase ${muted}`}>Статус</div>
                          <button
                            onClick={() => setDraftBanned((v) => !v)}
                            className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${
                              draftBanned
                                ? 'border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300'
                                : 'border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {draftBanned ? <BanIcon className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                              {draftBanned ? 'Заблокирован' : 'Активен'}
                            </span>
                            <span className="text-xs opacity-70">
                              нажмите, чтобы {draftBanned ? 'разблокировать' : 'заблокировать'}
                            </span>
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <RoleBadge role={draftRole} />
                          <StatusBadge banned={draftBanned} />
                        </div>
                      </div>
                    )}

                    {/* ACTIVITY */}
                    {tab === 'activity' && (
                      <div className="grid grid-cols-1 gap-4 pt-4 md:grid-cols-2">
                        <div className={`rounded-lg p-3 ${surface} border border-black/10 dark:border-white/10`}>
                          <div className={`mb-2 text-sm font-medium ${text}`}>Последние аппрувы/заявки</div>
                          <div className="max-h-[260px] space-y-2 overflow-auto pr-1">
                            {details?.approvals?.length ? (
                              details.approvals.map((a) => (
                                <div
                                  key={a.id}
                                  className="flex items-start justify-between rounded-md border border-black/10 dark:border-white/10 p-2"
                                >
                                  <div className="min-w-0">
                                    <div className={`truncate text-sm ${text}`}>{a.title || a.type}</div>
                                    <div className={`text-xs ${muted}`}>
                                      {a.status} • {new Date(a.created_at).toLocaleString('ru-RU')}
                                    </div>
                                  </div>
                                  <a
                                    href={`/admin/approvals/${a.id}`}
                                    className="ml-2 rounded-md px-2 py-1 text-xs hover:bg-gray-100 dark:hover:bg-white/10 border border-black/10 dark:border-white/10"
                                  >
                                    Открыть
                                  </a>
                                </div>
                              ))
                            ) : (
                              <div className={`text-sm ${muted}`}>Нет данных</div>
                            )}
                          </div>
                        </div>

                        <div className={`rounded-lg p-3 ${surface} border border-black/10 dark:border-white/10`}>
                          <div className={`mb-2 text-sm font-medium ${text}`}>Активность</div>
                          <div className="max-h-[260px] space-y-2 overflow-auto pr-1">
                            {details?.lastActivity?.length ? (
                              details.lastActivity.map((ev) => (
                                <div
                                  key={ev.id}
                                  className="flex items-start gap-2 rounded-md border border-black/10 dark:border-white/10 p-2"
                                >
                                  <Clock3 className="mt-0.5 h-4 w-4 text-gray-400" />
                                  <div className="min-w-0">
                                    <div className={`truncate text-sm ${text}`}>{ev.kind}</div>
                                    <div className={`text-xs ${muted}`}>
                                      {new Date(ev.when).toLocaleString('ru-RU')} • {ev.meta || ''}
                                    </div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className={`text-sm ${muted}`}>Нет событий</div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SECURITY */}
                    {tab === 'security' && details && (
                      <div className="pt-4 space-y-4">
                        <div className={`rounded-xl p-4 ${surface} border border-black/10 dark:border-white/10`}>
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <div className={`text-sm font-medium ${text}`}>Сессии</div>
                              <p className={`mt-1 text-sm ${muted}`}>
                                Завершить все активные сеансы пользователя (выйдет везде).
                              </p>
                            </div>
                            <button
                              className={btnPrimary + ' whitespace-nowrap'}
                              onClick={revokeSessions}
                              disabled={secBusy.revoke}
                            >
                              <LogOut className="mr-2 inline-block h-4 w-4" />
                              {secBusy.revoke ? 'Завершаем…' : 'Завершить все сеансы'}
                            </button>
                          </div>
                        </div>

                        <div className={`rounded-xl p-4 ${surface} border border-black/10 dark:border-white/10`}>
                          <div className="flex flex-col gap-3">
                            <div>
                              <div className={`text-sm font-medium ${text}`}>Сброс пароля</div>
                              <p className={`mt-1 text-sm ${muted}`}>
                                Создать одноразовую ссылку на смену пароля (действует 24 часа).
                              </p>
                            </div>

                            <div className="flex flex-col gap-3 md:flex-row md:items-center">
                              <button className={btn} onClick={createResetLink} disabled={secBusy.reset}>
                                <LinkIcon className="mr-2 inline-block h-4 w-4" />
                                {secBusy.reset ? 'Генерируем…' : 'Создать ссылку'}
                              </button>

                              {resetLink && (
                                <div className="flex w-full flex-col gap-2 md:flex-row md:items-center">
                                  <input className={`${input} flex-1 min-w-0`} readOnly value={resetLink} />
                                  <div className="flex shrink-0 gap-2">
                                    <button
                                      className={btn}
                                      onClick={() => navigator.clipboard.writeText(resetLink!)}
                                    >
                                      Копировать
                                    </button>
                                    <a href={resetLink} target="_blank" rel="noopener noreferrer" className={btn}>
                                      Открыть
                                    </a>
                                  </div>
                                </div>
                              )}
                            </div>

                            {resetLink && (
                              <div className={`text-xs ${muted}`}>
                                Поделись ссылкой с пользователем. Она перестанет работать через 24 часа или после
                                смены пароля.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* footer */}
                  <div className="flex items-center justify-between gap-3 border-t border-black/10 p-4 dark:border-white/10">
                    <div className={`text-xs ${muted}`}>
                      Создан: {new Date(details.profile.created_at).toLocaleString('ru-RU')}
                    </div>
                    <div className="flex items-center gap-2">
                      <button className={btn} onClick={closeModal}>
                        Отмена
                      </button>
                      <button className={btnPrimary} onClick={saveAll} disabled={saving}>
                        <Save className="mr-2 inline-block h-4 w-4" />
                        {saving ? 'Сохранение…' : 'Сохранить'}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}