// components/reader/ChapterReader.tsx
'use client';

import React, { useEffect, useRef } from 'react';
import PageViewer from './PageViewer';
import PageNavigation from './PageNavigation';
import ChapterMetadata from './ChapterMetadata';
import ChapterComments from './ChapterComments';
import { useChapterData } from '@/lib/reader/useChapterData';
import { useChapterNavigation } from '@/lib/reader/useChapterNavigation';
import { useReaderAuth } from '@/lib/reader/useReaderAuth';
import type { ChapterReaderProps } from '@/lib/reader/types';

const LOADING_GIF_SRC = '/images/profile-loading.gif';

export default function ChapterReader(props: ChapterReaderProps) {
  const topRef = useRef<HTMLDivElement>(null);
  const userId = useReaderAuth();

  // Загрузка данных главы
  const {
    pages,
    meta,
    nextHref,
    loading,
    error,
    chapterTeams,
    effectiveChapterId,
    effectiveMangaId,
  } = useChapterData(props);

  // Навигация
  const { index, setIndex, prevPage, goNext, scrollToReaderTop } =
    useChapterNavigation(pages, topRef, nextHref, meta, props);

  // Force dark theme
  useEffect(() => {
    document.documentElement.classList.add('reader-force-dark');
    document.body.classList.add('reader-force-dark');
    return () => {
      document.documentElement.classList.remove('reader-force-dark');
      document.body.classList.remove('reader-force-dark');
    };
  }, []);

  // === ЗАГРУЗКА ===
  if (loading) {
    return (
      <div className="relative max-w-[1400px] mx-auto px-6 py-12">
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <div className="rounded-2xl overflow-hidden ring-1 ring-border/40 shadow-lg">
            <img
              src={LOADING_GIF_SRC}
              alt="Загрузка…"
              className="block w-36 h-36 md:w-52 md:h-52 object-cover select-none"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
          <p className="text-muted-foreground">Загрузка главы…</p>
        </div>
      </div>
    );
  }

  // === ОШИБКА ===
  if (error) {
    return (
      <div className="relative max-w-[1400px] mx-auto px-6 py-12">
        <div className="flex flex-col items-center justify-center h-[40vh] gap-3">
          <p className="text-red-400">Ошибка: {error}</p>
        </div>
      </div>
    );
  }

  // === ПУСТО ===
  if (!pages.length) {
    return (
      <div className="relative max-w-[1400px] mx-auto px-6 py-12">
        <div className="flex flex-col items-center justify-center h-[40vh] gap-3">
          <p className="text-slate-400">Страниц нет</p>
        </div>
      </div>
    );
  }

  const currentPage = pages[index];

  return (
    <div className="mx-auto max-w-5xl p-3 sm:p-6 space-y-6">
      <div ref={topRef} />

      {/* Картинка страницы */}
      <PageViewer page={currentPage} index={index} onPrev={prevPage} onNext={goNext} />

      {/* Пейджер */}
      <PageNavigation
        pages={pages}
        index={index}
        onPageChange={(i) => {
          setIndex(i);
          scrollToReaderTop();
        }}
      />

      {/* Команды + лайки + закладки */}
      <ChapterMetadata
        chapterTeams={chapterTeams}
        chapterId={effectiveChapterId}
        mangaId={effectiveMangaId}
        currentPage={index + 1}
        userId={userId}
      />

      {/* Комментарии */}
      <ChapterComments pageId={currentPage.id} userId={userId} />
    </div>
  );
}
