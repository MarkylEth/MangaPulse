// lib/reader/useChapterNavigation.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { Page, ChapterMeta, ChapterReaderProps } from './types';

export function useChapterNavigation(
  pages: Page[],
  topRef: React.RefObject<HTMLDivElement>,
  nextHref: string | null,
  meta: ChapterMeta,
  props: ChapterReaderProps
) {
  const pathname = usePathname();
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const didMountRef = useRef(false);

  const byId = 'chapterId' in props && props.chapterId !== undefined;
  const mangaId = !byId ? String((props as any).mangaId) : null;
  const pageParam = !byId ? String((props as any).page ?? '1') : '1';

  // Set initial page
  useEffect(() => {
    const n = Math.max(1, Number(pageParam || 1)) - 1;
    setIndex(n);
  }, [pageParam]);

  // Update URL /p/N
  useEffect(() => {
    if (!pathname) return;
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    const base = pathname.replace(/\/p\/\d+\/?$/i, '');
    const next = `${base}/p/${Math.max(1, index + 1)}`;
    if (next !== window.location.pathname) {
      window.history.replaceState(null, '', next);
    }
  }, [index, pathname]);

  // Preload neighbors
  useEffect(() => {
    const nextUrl = pages[index + 1]?.url;
    const prevUrl = pages[index - 1]?.url;
    [nextUrl, prevUrl].filter(Boolean).forEach((src) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = src as string;
    });
  }, [index, pages]);

  const scrollToReaderTop = useCallback(() => {
    if (topRef.current) {
      topRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [topRef]);

  const prevPage = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
    scrollToReaderTop();
  }, [scrollToReaderTop]);

  const goNext = useCallback(() => {
    if (index + 1 < pages.length) {
      setIndex((i) => i + 1);
      scrollToReaderTop();
      return;
    }
    if (nextHref) {
      router.push(nextHref);
      return;
    }
    const mid = (meta?.manga_id ?? mangaId) as string | null;
    router.push(mid ? `/title/${mid}` : '/');
  }, [index, pages.length, nextHref, meta?.manga_id, mangaId, router, scrollToReaderTop]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prevPage();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prevPage, goNext]);

  return {
    index,
    setIndex,
    prevPage,
    goNext,
    scrollToReaderTop,
  };
}