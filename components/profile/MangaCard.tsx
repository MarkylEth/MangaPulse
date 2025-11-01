//components\profile\MangaCard.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreVertical, Check } from 'lucide-react';
import type { CardItem, Status } from './types';

import { openMangaOrBookmark } from '@/lib/navigation/openMangaOrBookmark';

type NonNullStatus = Exclude<Status, null>;

interface MangaCardProps {
  item: CardItem;
  theme: 'light' | 'dark';
  currentStatus: NonNullStatus | null;
  onSetStatus: (s: NonNullStatus) => void;
  onDelete: () => void;
  editable: boolean;
}

const STATUS_ORDER: readonly NonNullStatus[] = ['reading', 'completed', 'planned', 'dropped'] as const;
const STATUS_LABELS: Record<NonNullStatus, string> = {
  reading: 'Читаю',
  completed: 'Прочитано',
  planned: 'В планах',
  dropped: 'Брошено',
};

function MangaCardRaw({
  item, theme, currentStatus, onSetStatus, onDelete, editable,
}: MangaCardProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const handleOpen = useCallback(async (e?: React.MouseEvent) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    await openMangaOrBookmark(router, item.manga_id, item.title);
  }, [router, item.manga_id, item.title]);

  useEffect(() => {
    if (!menuOpen) return;

    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (menuRef.current?.contains(t)) return;
      if (menuButtonRef.current?.contains(t)) return;
      setMenuOpen(false);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const onMenuKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    }
  }, []);

  const title = item.title ?? 'Без названия';

  return (
    <div className="group relative">
      {/* Main Card - rounded, soft borders */}
      <button
        onClick={handleOpen}
        className="w-full text-left block"
        title={title}
        aria-label={`Открыть: ${title}`}
      >
        <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-card/50 backdrop-blur-sm border border-border/30 hover:border-border/50 transition-all duration-500 shadow-sm hover:shadow-xl">
          {/* Cover Image */}
          <div className="relative w-full h-full">
            {item.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.cover_url}
                alt={title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-muted/50 to-muted/20 flex items-center justify-center">
                <span className="text-muted-foreground/50 text-sm">Обложка</span>
              </div>
            )}
            
            {/* Gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            {/* Title overlay on hover */}
            <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
              <p className="text-xs font-medium text-foreground line-clamp-2">{title}</p>
            </div>
          </div>

          {/* Kebab Menu Button */}
          {editable && (
            <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <button
                ref={menuButtonRef}
                onClick={(e) => { 
                  e.stopPropagation(); 
                  e.preventDefault();
                  setMenuOpen((v) => !v); 
                }}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Ещё"
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-background/90 backdrop-blur-xl border border-border/50 shadow-lg hover:bg-background transition-all duration-200 hover:scale-110 active:scale-95"
              >
                <MoreVertical className="w-4 h-4 text-foreground" />
              </button>
            </div>
          )}
        </div>
      </button>

      {/* Title below card - minimal */}
      <div className="mt-2 px-1 opacity-100 group-hover:opacity-0 transition-opacity duration-300">
        <button
          onClick={handleOpen}
          className="text-left w-full"
          aria-label={`Перейти к манге: ${title}`}
        >
          <h3 className="text-sm font-medium line-clamp-2 text-foreground/80">
            {title}
          </h3>
        </button>
      </div>

      {/* Dropdown Menu - glassmorphism */}
      {menuOpen && editable && (
        <div
          ref={menuRef}
          role="menu"
          tabIndex={-1}
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 top-12 w-56 rounded-2xl border border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="py-2">
            {/* Status Header */}
            <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Статус
            </div>

            {/* Status Options */}
            {STATUS_ORDER.map((s) => {
              const isActive = currentStatus === s;
              return (
                <button
                  key={s}
                  role="menuitem"
                  onClick={() => { 
                    onSetStatus(s); 
                    setMenuOpen(false); 
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                    isActive 
                      ? 'bg-muted/50 text-foreground font-medium' 
                      : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground'
                  }`}
                >
                  <div className="w-5 h-5 flex items-center justify-center">
                    {isActive && <Check className="w-4 h-4" />}
                  </div>
                  <span className="flex-1 text-left">{STATUS_LABELS[s]}</span>
                </button>
              );
            })}

            {/* Divider */}
            <div className="my-2 h-px bg-border/30" />

            {/* Delete Option */}
            <button
              role="menuitem"
              onClick={() => { 
                onDelete(); 
                setMenuOpen(false); 
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <span className="text-lg"></span>
              </div>
              <span className="flex-1 text-left">Удалить</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const MangaCard = React.memo(MangaCardRaw);
export default MangaCard;