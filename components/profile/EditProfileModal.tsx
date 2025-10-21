//components\profile\EditProfileModal.tsx
'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Check } from 'lucide-react'; 
import { tryJson } from '@/lib/utils';
import type { EditValues } from './types';

async function tryOk(urls: string[], init?: RequestInit) {
  for (const url of urls) {
    try {
      const res = await fetch(url, { ...init, credentials: 'include', cache: 'no-store' });
      if (res.status === 404) continue;
      if (res.ok) return true;
    } catch {}
  }
  return false;
}

const GENRES_FALLBACK = [
  'Арт','Безумие','Боевик','Боевые искусства','Вампиры','Военное','Гарем','Гендерная интрига',
  'Героическое фэнтези','Демоны','Детектив','Дзёсэй','Драма','Игра','Исекай','История','Киберпанк',
  'Кодомо','Комедия','Космос','Магия','Махо-сёдзё','Машины','Меха','Мистика','Музыка',
  'Научная фантастика','Омегаверс','Пародия','Повседневность','Полиция','Постапокалиптика',
  'Приключения','Психология','Романтика','Самурайский боевик','Сверхъестественное',
  'Сёдзё','Сёнэн','Спорт','Супер сила','Сэйнэн','Трагедия','Триллер','Ужасы',
  'Фантастика','Фэнтези','Школа','Эротика','Этти',
];

/* --- SVG иконки соцсетей --- */
const TelegramIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.693-1.653-1.124-2.678-1.8-1.185-.781-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.008-1.252-.241-1.865-.44-.752-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635.099-.002.321.023.465.141.121.099.154.232.17.326.016.093.036.305.02.471z"/>
  </svg>
);

const VKIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm6.066 14.122c.42.45.863.873 1.213 1.371.155.22.302.447.408.698.15.355.014.746-.308.767l-2.03.001c-.521.043-.938-.165-1.288-.515-.276-.276-.53-.571-.793-.858-.11-.12-.225-.233-.36-.323-.258-.172-.484-.122-.644.142-.162.267-.199.565-.218.867-.027.432-.211.545-.642.565-0.922.042-1.797-.098-2.614-.567-.711-.407-1.266-.976-1.75-1.628-0.943-1.27-1.662-2.66-2.303-4.096-.137-.308-.036-.475.295-.482.546-.012 1.092-.011 1.637-.001.222.004.37.131.463.338.372.827.815 1.607 1.382 2.302.152.186.307.373.515.502.23.143.407.095.516-.161.069-.162.098-.336.114-.511.053-.586.06-1.171-.022-1.753-.047-.341-.231-.562-.572-.634-.175-.037-.149-.11-.064-.221.135-.176.262-.286.514-.286h1.897c.299.059.366.193.407.494l.002 2.105c-.005.125.062.497.287.58.179.054.299-.083.406-.195.496-.52.85-1.148 1.161-1.797.137-.285.256-.583.372-.881.086-.22.221-.33.469-.325l2.19.003c.065 0 .131.001.194.015.357.079.455.276.341.618-.167.501-.494.915-.821 1.326-.347.436-.72.853-1.065 1.292-.315.401-.289.602.076.954z"/>
  </svg>
);

const DiscordIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

const XIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M18.244 2H21l-6.52 7.457L22.5 22h-5.77l-4.51-5.89L6.1 22H3.344l6.98-7.968L1.5 2h5.86l4.06 5.39L18.244 2Zm-2.02 18h1.54L8.35 4h-1.6l9.474 16Z"/>
    </svg>
  );

/* --- Компонент --- */
export default function EditProfileModal({
  open, onClose, initial, onSaved, profileId,
}: {
  open: boolean;
  onClose: () => void;
  initial: EditValues;
  onSaved: (v: EditValues) => void;
  profileId: string;
}) {
  const [v, setV] = useState<EditValues>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allGenres, setAllGenres] = useState<string[]>(GENRES_FALLBACK);
  const [enabled, setEnabled] = useState({
    telegram: !!initial.telegram,
    x_url: !!initial.x_url,
    vk_url: !!initial.vk_url,
    discord_url: !!initial.discord_url,
  });

  const [uTouched, setUTouched] = useState(false);
  const [uStatus, setUStatus] = useState<'idle'|'checking'|'free'|'taken'>('idle');
  const [uErr, setUErr] = useState<string | null>(null);

  const USERNAME_RE = useMemo(() => /^[a-z0-9_]{3,20}$/, []);
  const usernameInvalid = !!v.username && !USERNAME_RE.test(v.username);
  const disableSave = saving || usernameInvalid || uStatus === 'checking' || uStatus === 'taken' || !!uErr;

  // --- авто-рост textarea "О себе"
  const bioRef = useRef<HTMLTextAreaElement | null>(null);
  const autoGrowBio = useCallback(() => {
    const el = bioRef.current;
    if (!el) return;
    el.style.height = '0px';
    // лимит роста ~ 14 строк
    const max = 320; // px
    el.style.height = Math.min(el.scrollHeight, max) + 'px';
  }, []);
  useEffect(() => { if (open) setTimeout(autoGrowBio, 0); }, [open, autoGrowBio]);
  useEffect(() => { autoGrowBio(); }, [v.bio, autoGrowBio]);

  // сброс на открытие
  useEffect(() => {
    if (!open) return;
    setUTouched(false);
    setUStatus('idle');
    setUErr(null);
    setV(initial);
    setError(null);
    setEnabled({
      telegram: !!initial.telegram,
      x_url: !!initial.x_url,
      vk_url: !!initial.vk_url,
      discord_url: !!initial.discord_url,
    });
  }, [open, initial]);

  // debounce-проверка username
  useEffect(() => {
    if (!uTouched) return;

    const u = v.username.trim();
    if (!u) { setUStatus('idle'); setUErr(null); return; }

    // если имя не проходит локальную проверку — просто показываем локальную ошибку,
    // НЕ дублируем uErr
    if (!USERNAME_RE.test(u)) {
      setUStatus('idle');
      setUErr(null);
      return;
    }

    setUErr(null);
    setUStatus('checking');

    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/profile/check-username?u=${encodeURIComponent(u)}&self=${encodeURIComponent(String(profileId || ''))}`,
          { cache: 'no-store' }
        );
        const json = await res.json().catch(() => null);
        if (!res.ok || !json) throw new Error('Ошибка проверки');
        setUStatus(json.available ? 'free' : 'taken');
      } catch {
        setUStatus('idle');
        setUErr('Не удалось проверить ник');
      }
    }, 350);

    return () => clearTimeout(t);
  }, [uTouched, v.username, profileId, USERNAME_RE]);

  // загрузка жанров один раз
  const genresLoadedRef = useRef(false);
  useEffect(() => {
    if (!open || genresLoadedRef.current) return;
    let alive = true;
    (async () => {
      try {
        const data = await tryJson(['/api/manga/genres', '/api/genres']);
        if (!alive || !Array.isArray(data)) return;
        const list = data.map((g: any) => g?.name).filter(Boolean);
        if (list.length) setAllGenres(list);
      } finally { genresLoadedRef.current = true; }
    })();
    return () => { alive = false; };
  }, [open]);

  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
  
    try {
      const payload = {
        id: profileId,
        username: v.username.trim(),
        full_name: v.full_name.trim() || null,
        avatar_url: v.avatar_url.trim() || null,
        bio: v.bio.trim() || null,
        banner_url: v.banner_url.trim() || null,
        favorite_genres: Array.isArray(v.favorite_genres) ? v.favorite_genres : [],
        telegram: enabled.telegram ? v.telegram.trim() || null : null,
        x_url: enabled.x_url ? v.x_url.trim() || null : null,
        vk_url: enabled.vk_url ? v.vk_url.trim() || null : null,
        discord_url: enabled.discord_url ? v.discord_url.trim() || null : null,
      };
  
      const uname = v.username.trim();
      if (!USERNAME_RE.test(uname)) {
        throw new Error('Имя пользователя: только a–z, 0–9, "_" и длина 3–20.');
      }
      if (uStatus === 'taken') {
        throw new Error('Имя пользователя занято.');
      }
  
      const response = await tryJson(
        ['/api/profile'],
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
  
      // новый формат { ok, data: { profile } }
      if (!response?.ok || !response?.data?.profile) {
        throw new Error('Не удалось сохранить профиль');
      }
  
      const savedProfile = response.data.profile;
  
      onSaved({
        username: savedProfile.username ?? '',
        full_name: savedProfile.full_name ?? '',
        avatar_url: savedProfile.avatar_url ?? '',
        bio: savedProfile.bio ?? '',
        banner_url: savedProfile.banner_url ?? '',
        favorite_genres: Array.isArray(savedProfile.favorite_genres) ? savedProfile.favorite_genres : [],
        telegram: savedProfile.telegram ?? '',
        x_url: savedProfile.x_url ?? '',
        vk_url: savedProfile.vk_url ?? '',
        discord_url: savedProfile.discord_url ?? '',
      });
  
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  }, [v, profileId, onSaved, onClose, USERNAME_RE, uStatus, enabled]);  

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-3xl max-h-[90vh] rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-xl font-bold">Редактировать профиль</h2>
              <button
                onClick={onClose}
                type="button"
                className="p-2 rounded-lg hover:bg-muted transition-colors"
                aria-label="Закрыть"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form
              id="editProfileForm"
              onSubmit={onSubmit}
              className="overflow-y-auto px-6 py-6 space-y-6 nice-scrollbar"
            >
              {error && (
                <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
                  {error}
                </div>
              )}

            {/* Banner & Avatar Preview — compact */}
            <div className="space-y-4">
              <div className="rounded-3xl overflow-hidden bg-card border border-border/50 shadow-lg">
                {/* Banner */}
                <div className="h-40 sm:h-48 md:h-56 relative">
                  {v.banner_url ? (
                    <img
                      src={v.banner_url}
                      alt="Banner"
                      className="absolute inset-0 h-full w-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-muted/40 via-muted/30 to-muted/20 relative overflow-hidden">
                      <div className="absolute top-0 left-1/3 w-80 h-80 bg-foreground/5 rounded-full blur-3xl animate-pulse" />
                      <div
                        className="absolute bottom-0 right-1/3 w-80 h-80 bg-foreground/5 rounded-full blur-3xl animate-pulse"
                        style={{ animationDelay: '1.5s' }}
                      />
                    </div>
                  )}
                </div>

                {/* Content под баннером */}
                <div className="px-5 sm:px-6 py-4 sm:py-5 flex items-start justify-between gap-4 bg-card flex-wrap">
                  <div className="flex items-center gap-4 sm:gap-5 min-w-0 flex-1">
                    {/* ✅ Avatar с правильным negative margin */}
                    <div className="-mt-14 sm:-mt-16">
                      <div className="relative group">
                        <div className="absolute inset-0 bg-muted/40 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        {/* ✅ Уменьшенный размер для модалки */}
                        <div className="relative h-24 w-24 sm:h-28 sm:w-28 overflow-hidden rounded-3xl bg-background ring-4 ring-background shadow-2xl border border-border/50">
                          {v.avatar_url ? (
                            <img
                              src={v.avatar_url}
                              alt="Avatar"
                              className="h-full w-full object-cover"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-3xl sm:text-4xl bg-gradient-to-br from-muted to-muted/50 text-muted-foreground">
                              ☻
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Name + Username */}
                    <div className="min-w-0 -mt-1 pt-0.5">
                      <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground mb-0.5 tracking-tight truncate">
                        {(v.full_name ?? '').trim() || (v.username || 'user')}
                      </h1>
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        @{v.username || 'user'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* URL инпуты (без изменений) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">URL баннера</label>
                  <input
                    type="url"
                    value={v.banner_url}
                    onChange={(e) => setV({ ...v, banner_url: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                    placeholder="https://example.com/banner.jpg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">URL аватара</label>
                  <input
                    type="url"
                    value={v.avatar_url}
                    onChange={(e) => setV({ ...v, avatar_url: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                    placeholder="https://example.com/avatar.jpg"
                  />
                </div>
              </div>
            </div>


              {/* Username & Full Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Имя пользователя <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={v.username}
                      onChange={(e) => { setV({ ...v, username: e.target.value }); setUTouched(true); }}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-accent/50"
                      placeholder="username"
                      aria-invalid={usernameInvalid || uStatus === 'taken' || !!uErr}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {uStatus === 'checking' && <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />}
                      {uStatus === 'free' && <Check className="w-4 h-4 text-emerald-500" />}
                      {uStatus === 'taken' && <X className="w-4 h-4 text-rose-500" />}
                    </div>
                  </div>
                  {/* показываем РОВНО одно сообщение */}
                  {usernameInvalid ? (
                    <p className="text-xs text-rose-500 mt-1">Только a–z, 0–9, _; длина 3–20</p>
                  ) : uStatus === 'taken' ? (
                    <p className="text-xs text-rose-500 mt-1">Имя уже занято</p>
                  ) : uErr ? (
                    <p className="text-xs text-rose-500 mt-1">{uErr}</p>
                  ) : null}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Полное имя</label>
                  <input
                    type="text"
                    value={v.full_name}
                    onChange={(e) => setV({ ...v, full_name: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/50"
                    placeholder="Ваше имя"
                  />
                </div>
              </div>

              {/* Bio — авто-рост, без скролла */}
              <div>
                <label className="block text-sm font-medium mb-2">О себе</label>
                <textarea
                  ref={bioRef}
                  value={v.bio}
                  onChange={(e) => setV({ ...v, bio: e.target.value })}
                  maxLength={500}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none overflow-hidden"
                  placeholder="Расскажите о себе..."
                  rows={4} /* стартовая высота */
                />
                <p className="text-xs text-muted-foreground mt-1">{v.bio.length} / 500</p>
              </div>

              {/* Favorite Genres */}
              <div>
                <label className="block text-sm font-medium mb-2">Любимые жанры</label>
                <div className="flex flex-wrap gap-1.5">
                  {allGenres.map((genre) => {
                    const isSelected = v.favorite_genres.includes(genre);
                    return (
                      <button
                        key={genre}
                        type="button"
                        onClick={() => {
                          setV({
                            ...v,
                            favorite_genres: isSelected
                              ? v.favorite_genres.filter(g => g !== genre)
                              : [...v.favorite_genres, genre]
                          });
                        }}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                          isSelected ? 'bg-accent text-white' : 'bg-muted text-foreground hover:bg-muted/80'
                        }`}
                        aria-pressed={isSelected}
                      >
                        {genre}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Social Links — сетка 2×2 */}
              <div>
                <label className="block text-sm font-medium mb-3">Социальные сети</label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Telegram */}
                  <div className="rounded-lg border border-border p-4 bg-background">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#0088cc] flex items-center justify-center text-white">
                          <TelegramIcon />
                        </div>
                        <span className="font-medium">Telegram</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEnabled({ ...enabled, telegram: !enabled.telegram })}
                        className={`relative w-12 h-6 rounded-full transition-colors ${enabled.telegram ? 'bg-accent' : 'bg-muted'}`}
                        aria-pressed={enabled.telegram}
                        aria-label="Вкл/Выкл Telegram"
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${enabled.telegram ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>
                    {enabled.telegram && (
                      <input
                        type="text"
                        value={v.telegram}
                        onChange={(e) => setV({ ...v, telegram: e.target.value })}
                        placeholder="@username"
                        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                      />
                    )}
                  </div>

                  {/* X */}
                    <div className="rounded-lg border border-border p-4 bg-background">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                        {/* всегда чёрный квадрат + белая иконка */}
                        <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center">
                            <XIcon className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-medium">X</span>
                        </div>
                        <button
                        type="button"
                        onClick={() => setEnabled({ ...enabled, x_url: !enabled.x_url })}
                        className={`relative w-12 h-6 rounded-full transition-colors ${enabled.x_url ? 'bg-accent' : 'bg-muted'}`}
                        aria-pressed={enabled.x_url}
                        aria-label="Вкл/Выкл X"
                        >
                        <span className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform
                                        ${enabled.x_url ? 'translate-x-6' : 'translate-x-0'}" />
                        </button>
                    </div>
                    {enabled.x_url && (
                        <input
                        type="url"
                        value={v.x_url}
                        onChange={(e) => setV({ ...v, x_url: e.target.value })}
                        placeholder="https://x.com/username"
                        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                        />
                    )}
                    </div>

                  {/* VK */}
                  <div className="rounded-lg border border-border p-4 bg-background">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#0077FF] flex items-center justify-center text-white">
                          <VKIcon />
                        </div>
                        <span className="font-medium">ВКонтакте</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEnabled({ ...enabled, vk_url: !enabled.vk_url })}
                        className={`relative w-12 h-6 rounded-full transition-colors ${enabled.vk_url ? 'bg-accent' : 'bg-muted'}`}
                        aria-pressed={enabled.vk_url}
                        aria-label="Вкл/Выкл VK"
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${enabled.vk_url ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>
                    {enabled.vk_url && (
                      <input
                        type="url"
                        value={v.vk_url}
                        onChange={(e) => setV({ ...v, vk_url: e.target.value })}
                        placeholder="https://vk.com/username"
                        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                      />
                    )}
                  </div>

                  {/* Discord */}
                  <div className="rounded-lg border border-border p-4 bg-background">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#5865F2] flex items-center justify-center text-white">
                          <DiscordIcon />
                        </div>
                        <span className="font-medium">Discord</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEnabled({ ...enabled, discord_url: !enabled.discord_url })}
                        className={`relative w-12 h-6 rounded-full transition-colors ${enabled.discord_url ? 'bg-accent' : 'bg-muted'}`}
                        aria-pressed={enabled.discord_url}
                        aria-label="Вкл/Выкл Discord"
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${enabled.discord_url ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>
                    {enabled.discord_url && (
                      <input
                        type="text"
                        value={v.discord_url}
                        onChange={(e) => setV({ ...v, discord_url: e.target.value })}
                        placeholder="username#1234"
                        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                      />
                    )}
                  </div>
                </div>
              </div>
            </form>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-muted hover:opacity-90 transition-opacity text-sm font-medium"
              >
                Отмена
              </button>
              <button
                type="submit"
                form="editProfileForm"
                disabled={disableSave}
                className="px-6 py-2 rounded-lg bg-accent hover:opacity-90 transition-opacity text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
