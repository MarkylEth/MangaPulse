'use client';

import type { Manga } from '@/components/home/types';
import { safeImageSrc } from '@/lib/safeImageSrc';

export default function MiniMangaCard({ manga }: { manga: Manga }) {
  const href = `/title/${manga.id}`;
  return (
    <a href={href} className="group block">
      <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-card/40 border border-border/30 hover:border-border transition-all">
        <img 
          src={safeImageSrc(manga.cover_url)} 
          alt={manga.title} 
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-2 left-2 right-2">
          <h4 className="text-xs font-medium line-clamp-2 text-white">{manga.title}</h4>
        </div>
      </div>
    </a>
  );
}
