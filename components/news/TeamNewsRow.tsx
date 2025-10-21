'use client';

import Link from 'next/link';
import { Megaphone } from 'lucide-react';
import type { TeamNewsItem } from '@/components/home/types';

export default function TeamNewsRow({ it }: { it: TeamNewsItem }) {
  return (
    <Link
      href={`/news/${it.id}`}
      className="flex items-center gap-3 rounded-lg border border-border/50 p-2 hover:bg-muted transition-colors"
    >
      <div className="grid place-items-center h-10 w-7">
        <Megaphone className="w-4 h-4 text-indigo-400" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{it.title}</div>
        <div className="text-[11px] text-muted-foreground">
          {new Date(it.created_at).toLocaleString('ru-RU')}
          {it.pinned ? ' · закреплено' : ''}
        </div>
      </div>
    </Link>
  );
}
