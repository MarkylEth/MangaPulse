'use client';

import React from 'react';
import Link from 'next/link';
import type { Chapter } from './types';

export default function SidebarProgress({
  bookmark, chapters, slugId, firstChapterId,
}: {
  bookmark: { chapter_id: number; page: number | null } | null;
  chapters: Chapter[];
  slugId: string;
  firstChapterId: number | null;
}) {
  return (
    <div className="rounded-xl p-4 bg-card border border-border">
      <h3 className="text-sm font-medium mb-3">Прогресс чтения</h3>

      {bookmark ? (
        <>
          <div className="text-sm text-muted-foreground mb-2">
            Ваша последняя закладка:
          </div>
          <div className="text-2xl font-bold mb-3">
            Глава {(() => {
              const ch = chapters.find(c => c.id === bookmark.chapter_id);
              return ch ? ch.chapter_number : '—';
            })()}
            {bookmark.page ? <span className="text-muted-foreground"> · стр. {bookmark.page}</span> : null}
          </div>
          <Link
            href={(() => {
              const ch = chapters.find(c => c.id === bookmark.chapter_id);
              if (!ch) return `/title/${slugId}`;
              const vol = (ch.vol_number ?? 'none');
              const page = bookmark.page ?? 1;
              return `/title/${slugId}/v/${vol}/c/${ch.chapter_number}/p/${page}`;
            })()}
            className="inline-block rounded-md bg-muted px-3 py-2 text-sm border border-border hover:opacity-90 transition-colors"
          >
            Продолжить чтение
          </Link>
        </>
      ) : (
        <>
          <div className="text-sm text-muted-foreground mb-2">
            Закладок пока нет
          </div>
          {firstChapterId && (
            <Link
              href={`/title/${slugId}/chapter/${firstChapterId}`}
              className="inline-block rounded-md bg-muted px-3 py-2 text-sm border border-border hover:opacity-90 transition-colors"
            >
              Начать чтение
            </Link>
          )}
        </>
      )}
    </div>
  );
}
