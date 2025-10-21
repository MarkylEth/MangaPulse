// components/TitleBookmarks.tsx
'use client';

import { libraryQueue } from '@/lib/libraryQueue';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Clock, CheckCircle, Ban, Heart, Bookmark, ChevronDown, Info } from 'lucide-react';

export type LibStatus = 'planned' | 'reading' | 'completed' | 'dropped';

export interface TitleBookmarksProps {
  mangaId: number;
  className?: string;
  theme?: 'dark' | 'light';
  /** если явно false — считаем гостем и не дёргаем личные данные */
  loggedIn?: boolean;
}

function resolveTheme(explicit?: 'dark' | 'light'): 'dark' | 'light' {
  if (explicit) return explicit;
  if (typeof document !== 'undefined') {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  }
  return 'light';
}

type StatusOption = {
  value: LibStatus;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const STATUS_OPTIONS: StatusOption[] = [
  { value: 'reading',   label: 'Читаю',     Icon: BookOpen },
  { value: 'planned',   label: 'В планах',  Icon: Clock },
  { value: 'completed', label: 'Прочитано', Icon: CheckCircle },
  { value: 'dropped',   label: 'Брошено',   Icon: Ban },
];

type LibraryEntry = { manga_id: number; status: LibStatus | null; favorite: boolean };

export default function TitleBookmarks({
  mangaId,
  className = '',
  theme: explicitTheme,
  loggedIn: loggedInProp,
}: TitleBookmarksProps) {
  const [mounted, setMounted] = useState(false);
  const theme = useMemo(() => resolveTheme(explicitTheme), [explicitTheme]);

  const [status, setStatus]     = useState<LibStatus | null>(null);
  const [fav, setFav]           = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // saving оставляем, но UI на нём не завязываем (для возможной телеметрии/логики)
  const [saving, setSaving]     = useState(false);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  const [toast, setToast] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => setMounted(true), []);

  /* ---- слегка более тёмные поверхности для светлой темы ---- */
  const btnSurfaceLight = 'bg-slate-100 text-slate-900 ring-1 ring-slate-300/70 shadow-sm hover:bg-slate-200';
  const btnSurfaceDark  = 'bg-slate-900/70 text-slate-100 ring-1 ring-white/10 backdrop-blur hover:bg-slate-800/70';
  const baseBtn = theme === 'light' ? btnSurfaceLight : btnSurfaceDark;

  // «таблетка»-кнопка: без фокус-ореолов и спиннеров; лёгкая обратная связь при нажатии
  const pill = (extra = '') =>
    `inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors
     focus:outline-none focus-visible:outline-none active:scale-[.99]
     ${baseBtn} ${extra}`;

  const showToast = (msg: string) => {
    setToast(msg);
    window.clearTimeout((showToast as any)._t);
    (showToast as any)._t = window.setTimeout(() => setToast(null), 2200);
  };

  /* ---------- тихое закрытие меню по клику вне ---------- */
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  /* ---------- ЛИЧНАЯ ЗАПИСЬ: простая загрузка ---------- */
  useEffect(() => {
    let stop = false;

    if (loggedInProp === false) {
      setLoggedIn(false);
      setStatus(null);
      setFav(false);
      return () => { stop = true; };
    }

    (async () => {
      try {
        const res = await fetch(`/api/manga/${mangaId}/library`, {
          credentials: 'include',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        if (stop) return;

        if (res.status === 401) {
          setLoggedIn(false);
          setStatus(null);
          setFav(false);
          return;
        }

        const data = await res.json().catch(() => ({}));
        const item: LibraryEntry | null = data?.item ?? null;

        setLoggedIn(true);
        if (item) {
          setStatus(item.status ?? null);
          setFav(!!item.favorite);
        } else {
          setStatus(null);
          setFav(false);
        }
      } catch {
        if (!stop) {
          setLoggedIn(false);
          setStatus(null);
          setFav(false);
        }
      }
    })();

    return () => { stop = true; };
  }, [mangaId, loggedInProp]);

  const requireAuth = () => {
    if (loggedIn) return true;
    showToast('Войдите, чтобы пользоваться закладками.');
    return false;
  };

  /* ---------- «тихие» флаги занятости без влияния на UI ---------- */
  const busyFavRef = useRef(false);
  const busyStatusRef = useRef(false);
  function cooldown(ref: React.MutableRefObject<boolean>, ms = 350) {
    ref.current = true;
    setTimeout(() => { ref.current = false; }, ms);
  }

  /* ---------- избранное (без спиннеров/дизейблов) ---------- */
// вместо onToggleFav с fetch — пишем в очередь
const onToggleFav = () => {
  if (!requireAuth()) return;
  const next = !fav;
  setFav(next); // оптимистично
  libraryQueue.upsert({ manga_id: mangaId, favorite: next });
  // по желанию: если пользователь закончил серию кликов — флашнем через секунду
  libraryQueue.flushSoon(1200);
};

// вместо onPickStatus с fetch — пишем в очередь
const onPickStatus = (value: LibStatus) => {
  setMenuOpen(false);
  if (!requireAuth()) return;
  const prev = status;
  setStatus(value); // оптимистично
  libraryQueue.upsert({ manga_id: mangaId, status: value });
  libraryQueue.flushSoon(1200);
};


  const current = STATUS_OPTIONS.find((o) => o.value === status);
  const CurrentIcon = (current?.Icon ?? Bookmark) as any;

  if (!mounted) {
    return (
      <div className={['flex flex-col gap-2', className].join(' ')}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="h-9 w-28 rounded-xl bg-transparent" />
          <div className="h-9 w-28 rounded-xl bg-transparent" />
        </div>
        <div className="h-4 w-64 rounded bg-transparent" />
      </div>
    );
  }

  const favPillText = fav ? 'В избранном' : 'В избранное';

  return (
    <div className={['relative flex flex-col gap-2', className].filter(Boolean).join(' ')}>
      <div className="flex flex-wrap items-center gap-2">
        {/* статус */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className={pill()}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <CurrentIcon className="h-4 w-4" />
            {current ? current.label : 'Мой статус'}
            <ChevronDown className="h-4 w-4 opacity-70" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className={`absolute z-50 mt-2 w-48 rounded-2xl overflow-hidden shadow-lg
                          ${theme === 'light'
                            ? 'bg-slate-100 text-slate-900 ring-1 ring-slate-300/70'
                            : 'bg-slate-900/95 text-white ring-1 ring-white/10 backdrop-blur'}`}
            >
              <div className={`${theme === 'light' ? 'divide-slate-300/60' : 'divide-white/10'} divide-y`}>
                {STATUS_OPTIONS.map(({ value, label, Icon }) => {
                  const active = status === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => onPickStatus(value)}
                      role="menuitem"
                      className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors
                                  ${theme === 'light'
                                    ? 'text-slate-900 hover:bg-slate-200 focus:bg-slate-200'
                                    : 'text-white hover:bg-white/10 focus:bg-white/10'}
                                  ${active ? '' : 'opacity-90'}`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                      {active && <span className="ml-auto text-[11px] opacity-70">текущий</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* избранное */}
        <button
          type="button"
          onClick={onToggleFav}
          className={pill()}
          aria-pressed={fav}
        >
          <Heart
            className={`h-4 w-4 ${
              fav
                ? 'text-black fill-[#7f1d1d] [fill-opacity:.95]'
                : 'text-slate-700 fill-transparent'
            }`}
            strokeWidth={1.6}
          />
          {favPillText}
        </button>
      </div>

      {loggedIn === false && (
        <div className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-slate-400'}`}>
          Войдите в аккаунт, чтобы сохранять «избранное» и статус чтения.
        </div>
      )}

      {toast && (
        <div
          className={`pointer-events-none absolute -bottom-10 left-0 flex items-center gap-2 rounded-lg px-3 py-2 text-sm shadow
                      ${theme === 'light' ? 'bg-slate-900 text-white' : 'bg-white/90 text-slate-900'}`}
          role="status"
          aria-live="polite"
        >
          <Info className="h-4 w-4" />
          {toast}
        </div>
      )}
    </div>
  );
}
