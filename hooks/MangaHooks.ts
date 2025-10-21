// hooks/MangaHooks.ts
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getJson } from 'lib/utils';
import type {
  Chapter,
  Genre,
  RatingRow,
  Team,
  Manga,
  MeInfo,
  PersonLink,
  PublisherLink,
} from '../components/title-page/types';

interface UseMangaBundleOptions {
  skipInitialFetch?: boolean; // NEW: опция для пропуска начального запроса
}

export function useMangaBundle(
  apiKey: string | number,
  initialChapters: Chapter[] = [],
  options: UseMangaBundleOptions = {}
) {
  const { skipInitialFetch = initialChapters.length > 0 } = options;
  
  const [loading, setLoading] = useState(false);
  const [manga, setManga] = useState<Manga | null>(null);
  const [realId, setRealId] = useState<number | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>(initialChapters);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [ratings, setRatings] = useState<RatingRow[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [me, setMe] = useState<MeInfo>(null);
  const [authors, setAuthors] = useState<PersonLink[]>([]);
  const [artists, setArtists] = useState<PersonLink[]>([]);
  const [publishers, setPublishers] = useState<PublisherLink[]>([]);
  const [bookmark, setBookmark] = useState<{ chapter_id: number; page: number | null } | null>(null);

  const isFirstRenderRef = useRef(true);
  const lastApiKeyRef = useRef<string | number>(apiKey);

  useEffect(() => {
    // Если это первый рендер И есть initial data - НЕ делаем запрос
    if (isFirstRenderRef.current && skipInitialFetch) {
      isFirstRenderRef.current = false;
      // Устанавливаем realId из apiKey для корректной работы
      const numId = String(apiKey).match(/^\d+/)?.[0];
      if (numId) setRealId(Number(numId));
      return;
    }

    // Если apiKey не изменился - не делаем повторный запрос
    if (!isFirstRenderRef.current && lastApiKeyRef.current === apiKey) {
      return;
    }

    let cancelled = false;
    
    (async () => {
      setLoading(true);
      
      try {
        const data: any = await getJson(`/api/manga/${apiKey}/bundle`);
        
        if (cancelled) return;

        const found: Manga | null = data?.item ?? null;
        setManga(found);
        
        const id = Number(found?.id ?? 0) || null;
        setRealId(id);

        if (!id) {
          setGenres([]);
          setChapters([]);
          setRatings([]);
          setTags([]);
          setTeams([]);
          setAuthors([]);
          setArtists([]);
          setPublishers([]);
          setBookmark(null);
          setLoading(false);
          return;
        }

        setChapters(
          (Array.isArray(data?.chapters) ? data.chapters : []).map((c: any) => ({
            ...c,
            chapter_number: Number(c.chapter_number),
            vol_number: c.vol_number == null ? null : Number(c.vol_number),
          }))
        );

        setRatings(Array.isArray(data?.ratings) ? data.ratings : []);
        setTags(Array.isArray(data?.tags) ? data.tags : []);
        
        const g: string[] = Array.isArray(data?.genres) ? data.genres : [];
        setGenres(
          g.map((name: string, i: number) => ({
            id: `local-${i}`,
            manga_id: id,
            genre: name,
          }))
        );

        setTeams(Array.isArray(data?.teams) ? data.teams : []);
        setMe(data?.me ?? null);

        const ppl = (data?.people ?? {}) as { authors?: PersonLink[]; artists?: PersonLink[] };
        setAuthors(Array.isArray(ppl?.authors) ? ppl.authors : []);
        setArtists(Array.isArray(ppl?.artists) ? ppl.artists : []);
        setPublishers(Array.isArray(data?.publishers) ? data.publishers : []);
        setBookmark(data?.bookmark ?? null);

      } catch (err) {
        console.error('[useMangaBundle] Fetch error:', err);
      } finally {
        setLoading(false);
        isFirstRenderRef.current = false;
        lastApiKeyRef.current = apiKey;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiKey, skipInitialFetch]);

  const reloadChapters = useCallback(async () => {
    const id = Number(realId ?? 0);
    if (!id) return;
    
    try {
      const data: any = await getJson(`/api/manga/${id}/bundle`);
      const list = Array.isArray(data?.chapters) ? data.chapters : [];
      
      setChapters(
        list.map((c: any) => ({
          ...c,
          chapter_number: Number(c.chapter_number),
          vol_number: c.vol_number == null ? null : Number(c.vol_number),
        }))
      );
    } catch (err) {
      console.error('[reloadChapters] Error:', err);
    }
  }, [realId]);

  return {
    loading,
    manga,
    realId,
    chapters,
    genres,
    ratings,
    tags,
    teams,
    me,
    authors,
    artists,
    publishers,
    bookmark,
    reloadChapters,
  };
}