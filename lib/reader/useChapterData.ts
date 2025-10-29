// lib/reader/useChapterData.ts
import { useEffect, useMemo, useState } from 'react';
import type { Page, ChapterMeta, TeamInfo, ChapterReaderProps } from './types';

const numId = (idOrSlug: string) => idOrSlug.match(/\d+/)?.[0] ?? idOrSlug;

function isNoneLike(v: any) {
  const s = String(v ?? '').trim().toLowerCase();
  return s === '' || s === 'none' || s === 'null' || s === 'undefined';
}

function pickVolForUrl(nextVol: any, currentVolFromUrl: any) {
  const n = String(nextVol ?? '').trim();
  if (n && !isNoneLike(n)) return n;
  const c = String(currentVolFromUrl ?? '').trim();
  if (c && !isNoneLike(c)) return c;
  return 'none';
}

function buildChapterUrl(midForUrl: string, volForUrl: string, ch: string | number, page = 1) {
  return `/title/${midForUrl}/v/${encodeURIComponent(volForUrl)}/c/${encodeURIComponent(ch)}/p/${page}`;
}

export function useChapterData(props: ChapterReaderProps) {
  const byId = 'chapterId' in props && props.chapterId !== undefined;
  const chapterId = byId ? String((props as any).chapterId) : null;
  const mangaId = !byId ? String((props as any).mangaId) : null;
  const vol = !byId ? String((props as any).vol) : null;
  const chapter = !byId ? String((props as any).chapter) : null;
  const pageParam = !byId ? String((props as any).page ?? '1') : '1';

  const mangaIdForApi = useMemo(() => (mangaId ? numId(String(mangaId)) : null), [mangaId]);

  const pagesUrl = useMemo(() => {
    if (byId && chapterId)
      return `/api/reader/chapter/${encodeURIComponent(chapterId)}/pages`;
    if (!byId && mangaIdForApi && vol != null && chapter != null)
      return `/api/reader/${encodeURIComponent(mangaIdForApi)}/volume/${encodeURIComponent(
        vol
      )}/chapters/${encodeURIComponent(chapter)}/pages`;
    return '';
  }, [byId, chapterId, mangaIdForApi, vol, chapter]);

  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<ChapterMeta>({});
  const [nextHref, setNextHref] = useState<string | null>(null);
  const [chapterTeams, setChapterTeams] = useState<TeamInfo[]>([]);

  const effectiveChapterId = useMemo(() => {
    if (byId && chapterId) return Number(chapterId);
    return Number(pages[0]?.chapter_id || 0);
  }, [byId, chapterId, pages]);

  const effectiveMangaId = useMemo(() => {
    if (!byId) return Number(mangaId ?? meta?.manga_id ?? 0);
    return Number(meta?.manga_id ?? 0);
  }, [byId, mangaId, meta?.manga_id]);

  // Load pages
  useEffect(() => {
    if (!pagesUrl) return;
    let cancel = false;
    setLoading(true);
    setError(null);

    fetch(pagesUrl, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j?.error || `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((j) => {
        if (cancel) return;
        const arr: Page[] = (
          Array.isArray(j?.pages) ? j.pages : Array.isArray(j?.items) ? j.items : []
        )
          .map((p: any) => ({
            id: Number(p.id),
            chapter_id: Number(p.chapter_id),
            index: Number(p.index ?? p.page_index ?? p.page_number ?? 0),
            url: String(p.url ?? p.image_url ?? ''),
            width: p.width ?? null,
            height: p.height ?? null,
            volume_index: p.volume_index == null ? null : Number(p.volume_index),
          }))
          .sort((a: Page, b: Page) => a.index - b.index || a.id - b.id);

        setPages(arr);
      })
      .catch((e: any) => !cancel && setError(e.message || 'Ошибка загрузки'))
      .finally(() => !cancel && setLoading(false));

    return () => {
      cancel = true;
    };
  }, [pagesUrl]);

  // Load meta & next chapter
  useEffect(() => {
    let cancel = false;

    const pick = {
      vol: (o: any) =>
        o?.vol_number ?? o?.volume_number ?? o?.volume_index ?? o?.vol ?? o?.volume ?? null,
      ch: (o: any) => o?.chapter_number ?? o?.chapter ?? o?.ch ?? o?.number ?? null,
    };

    const fetchJson = async (url: string) => {
      try {
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) return null;
        return await r.json();
      } catch {
        return null;
      }
    };

    const resolveVolViaChapterId = async (chapterId: any) => {
      if (!chapterId) return null;
      const j = await fetchJson(`/api/chapters/${encodeURIComponent(chapterId)}`);
      const v = pick.vol(j?.item ?? null);
      return v == null ? null : String(v);
    };

    const findNextChapterFromList = async (
      midForApi: string,
      currentCh: string,
      currentVolFromUrl: string,
      midForUrl?: string
    ) => {
      const j = await fetchJson(`/api/manga/${midForApi}/chapters?limit=500`);
      if (!j || !j.items) return null;

      const chapters = j.items
        .map((item: any) => {
          const rawVol = pick.vol(item);
          const ch = pick.ch(item);
          if (ch == null) return null;
          return {
            vol: rawVol == null ? null : String(rawVol),
            ch: String(ch),
            id: item.id,
          };
        })
        .filter(Boolean) as { vol: string | null; ch: string; id: any }[];

      if (!chapters.length) return null;

      chapters.sort((a, b) => Number(a.ch) - Number(b.ch));

      const currentChNum = Number(currentCh);
      const currentIndex = chapters.findIndex((c) => Number(c.ch) === currentChNum);

      if (currentIndex >= 0 && currentIndex < chapters.length - 1) {
        const next = chapters[currentIndex + 1];

        let nextVol = next.vol;
        if (nextVol == null || isNoneLike(nextVol)) {
          const v = await resolveVolViaChapterId(next.id);
          if (v != null && !isNoneLike(v)) nextVol = v;
        }

        const volForUrl = pickVolForUrl(nextVol, currentVolFromUrl);
        const midUrl = midForUrl ?? midForApi;
        return buildChapterUrl(midUrl, volForUrl, next.ch, 1);
      }
      return null;
    };

    (async () => {
      try {
        if (byId && chapterId) {
          const r = await fetch(`/api/chapters/${encodeURIComponent(chapterId)}`, {
            cache: 'no-store',
          });
          const j = await r.json().catch(() => ({}));
          const chMeta: ChapterMeta = j?.item ?? {};
          if (!cancel) setMeta(chMeta);

          const midForApi = String(chMeta?.manga_id ?? '');
          const curCh = String(chMeta?.chapter_number ?? '');
          const currentVolFromUrl = String(vol ?? chMeta?.vol ?? 'none');

          if (midForApi && curCh) {
            const href = await findNextChapterFromList(
              numId(midForApi),
              curCh,
              currentVolFromUrl,
              (mangaId ?? midForApi) as string
            );
            if (!cancel) setNextHref(href);
          } else if (!cancel) {
            setNextHref(null);
          }
          return;
        }

        if (!byId && mangaId && chapter != null) {
          if (!cancel) setMeta({ manga_id: mangaId, vol, chapter_number: chapter });

          const href = await findNextChapterFromList(
            String(mangaIdForApi!),
            String(chapter),
            String(vol ?? 'none'),
            String(mangaId)
          );
          if (!cancel) setNextHref(href);
        }
      } catch {
        if (!cancel) setNextHref(null);
      }
    })();

    return () => {
      cancel = true;
    };
  }, [byId, chapterId, mangaId, mangaIdForApi, vol, chapter]);

  // Load teams
  useEffect(() => {
    let abort = false;
    (async () => {
      const cid = effectiveChapterId;
      if (!cid) {
        setChapterTeams([]);
        return;
      }
      try {
        const r = await fetch(`/api/chapters/${cid}/teams`, { cache: 'no-store' });
        const j = await r.json().catch(() => ({}));
        if (!abort) setChapterTeams((j?.items ?? []) as TeamInfo[]);
      } catch {
        if (!abort) setChapterTeams([]);
      }
    })();
    return () => {
      abort = true;
    };
  }, [effectiveChapterId]);

  return {
    pages,
    meta,
    nextHref,
    loading,
    error,
    chapterTeams,
    effectiveChapterId,
    effectiveMangaId,
  };
}