'use client';

import Link from 'next/link';
import type { ChapterFeedItem } from '@/components/home/types';
import { clsx, formatTimeAgo } from '@/lib/utils';
import { safeImageSrc } from '@/lib/safeImageSrc';

export default function CompactFeedRow({ item, isNew }: { item: ChapterFeedItem; isNew?: boolean }) {
  const href = `/title/${item.manga_id}?ch=${item.chapter_id}`;
  const chapterLabel = item.chapter_number ? `Гл. ${item.chapter_number}` : 'Новая';
  return (
    <Link href={href} className="block group">
      <div className={clsx(
        'relative flex gap-3 p-2 rounded-lg transition-all',
        'hover:bg-muted',
        isNew && 'bg-muted'
      )}>
        {isNew && (
          <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        )}
        <div className="relative w-12 h-16 shrink-0 rounded overflow-hidden">
          <img src={safeImageSrc(item.cover_url)} alt={item.manga_title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate group-hover:text-foreground transition-colors">{item.manga_title}</div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {chapterLabel}{item.volume ? ` · Т.${item.volume}` : ''}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">{formatTimeAgo(item.created_at)}</div>
        </div>
      </div>
    </Link>
  );
}
