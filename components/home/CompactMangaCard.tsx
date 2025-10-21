'use client';

import { Star, Clock, BookOpen } from 'lucide-react';
import type { Manga } from '@/components/home/types';
import { clsx } from '@/lib/utils';
import { safeImageSrc } from '@/lib/safeImageSrc';

export default function CompactMangaCard({ manga }: { manga: Manga }) {
  const href = `/title/${manga.id}`;
  const isHighRated = manga.rating >= 8;
  return (
    <a href={href} className="group block">
      <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-card border border-border/40 hover:border-border transition-colors">
        <img 
          src={safeImageSrc(manga.cover_url)} 
          alt={manga.title} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        {manga.rating > 0 && (
          <div className={clsx(
            'absolute top-2 right-2 flex items-center gap-1 backdrop-blur-sm rounded-full px-2 py-1 transition-all',
            isHighRated 
              ? 'bg-gradient-to-r from-amber-500/90 to-orange-500/90 shadow-lg shadow-amber-500/30' 
              : 'bg-black/70'
          )}>
            <Star className={clsx('w-3 h-3', isHighRated ? 'text-white' : 'text-muted-foreground')} fill="currentColor" />
            <span className={clsx('text-xs font-medium', isHighRated ? 'text-white' : 'text-foreground')}>{manga.rating.toFixed(1)}</span>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
          <div className="flex items-center gap-2 text-xs text-foreground mb-2">
            {manga.chapters_count > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-black/50 backdrop-blur-sm">
                <BookOpen className="w-3 h-3" />
                <span>{manga.chapters_count}</span>
              </div>
            )}
            {manga.year && (
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-black/50 backdrop-blur-sm">
                <Clock className="w-3 h-3" />
                <span>{manga.year}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="mt-2">
        <h3 className="text-sm font-medium line-clamp-2 group-hover:text-foreground transition-colors">{manga.title}</h3>
        {manga.genres && manga.genres.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {manga.genres.slice(0, 2).map((g, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/50">
                {g}
              </span>
            ))}
            {manga.genres.length > 2 && (
              <span className="text-[10px] px-1.5 py-0.5 text-muted-foreground">+{manga.genres.length - 2}</span>
            )}
          </div>
        )}
      </div>
    </a>
  );
}
