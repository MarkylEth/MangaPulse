'use client';

import React from 'react';
import Link from 'next/link';
import { BookmarkCheck } from 'lucide-react';
import AddChapterButton from '@/components/AddChapterButton';
import type { Chapter, ChapterGroup } from './types';

export default function ChaptersPanel({
  canEdit, isLeader, onAdded, groups, slugId, bookmark, mid, chapters,
}: {
  canEdit: boolean;
  isLeader: boolean;
  onAdded: () => void;
  groups: ChapterGroup[];
  slugId: string;
  bookmark: { chapter_id: number; page: number | null } | null;
  mid: number;
  chapters: Chapter[];
}) {
  return (
    <div className="relative">
      {(canEdit || isLeader) && (
        <div className="absolute right-0 -top-4 z-20 [&>button]:bg-card [&>button:hover]:bg-card/90 [&>button]:text-foreground [&>button]:border [&>button]:border-border [&>button]:shadow-sm [&>button]:rounded-xl">
          <AddChapterButton mangaId={mid} onDone={onAdded} />
        </div>
      )}

      <div className="space-y-2">
        {groups.length === 0 && (
          <div className="text-muted-foreground text-center py-8">
            Глав пока нет.
          </div>
        )}

        {groups.map((group) => (
          <div key={`vol-${group.vol ?? 'none'}`}>
            <div className="text-muted-foreground text-sm mb-2 px-4">
              {group.vol != null ? `Том ${group.vol}` : 'Без тома'} 
            </div>

            {group.items.map((ch) => {
              const isBm = !!bookmark && bookmark.chapter_id === ch.id;
              return (
                <a
                  key={ch.id}
                  href={`/title/${slugId}/chapter/${ch.id}`}
                  className="flex items-center px-4 py-3 hover:bg-muted rounded-lg transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      Глава {ch.chapter_number}{ch.title ? ` — ${ch.title}` : ''}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {new Date(ch.created_at).toLocaleDateString('ru-RU')}
                    </div>
                  </div>

                  <div className="ml-3 w-6 flex items-center justify-center">
                    {isBm ? (
                      <span
                        title={bookmark?.page ? `Закладка · стр. ${bookmark.page}` : 'Закладка на этой главе'}
                        aria-label="Закладка на этой главе"
                        className="inline-flex"
                      >
                        <BookmarkCheck className="w-5 h-5 text-red-500" />
                      </span>
                    ) : null}
                  </div>
                </a>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
