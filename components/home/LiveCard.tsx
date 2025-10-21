'use client';

import { Star, BookOpen } from 'lucide-react';
import type { Manga } from '@/components/home/types';
import { safeImageSrc } from '@/lib/safeImageSrc';

export default function LiveCard({ manga }: { manga: Manga }) {
  const href = `/title/${manga.id}`;
  return (
    <a href={href} className="group/card block">
      <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm transition-all hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/10">
        <div className="relative aspect-[3/4] overflow-hidden">
          <img 
            src={safeImageSrc(manga.cover_url)} 
            alt={manga.title} 
            className="w-full h-full object-cover transition-transform duration-700 group-hover/card:scale-110" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
          <div className="absolute top-3 right-3 p-0.5 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-lg shadow-xl">
            <div className="bg-background rounded-md px-3 py-1.5">
              <div className="flex items-center gap-1.5">
                <Star className="w-4 h-4 text-amber-400" fill="currentColor" />
                <span className="text-sm text-foreground font-bold">{manga.rating.toFixed(1)}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="p-4">
          <h3 
            className="font-semibold line-clamp-2 min-h-[3.5rem] mb-2 text-lg group-hover/card:text-amber-400 transition-colors"
            title={manga.title}
          >
            {manga.title}
          </h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <div className="flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" />
              <span>{manga.chapters_count} глав</span>
            </div>
            <span>·</span>
            <span>{manga.year}</span>
            {manga.author && (
              <>
                <span>·</span>
                <span className="truncate max-w-[120px]" title={manga.author}>{manga.author}</span>
              </>
            )}
          </div>
          {manga.genres && manga.genres.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {manga.genres.slice(0, 2).map((g, i) => (
                <span key={i} className="text-[10px] px-2 py-1 rounded-full bg-muted text-muted-foreground border border-border/50 truncate max-w-[80px]">
                  {g}
                </span>
              ))}
              {manga.genres.length > 2 && (
                <span className="text-[10px] px-2 py-1 rounded-full bg-muted text-muted-foreground border border-border/50 cursor-pointer">
                  +{manga.genres.length - 2}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </a>
  );
}
