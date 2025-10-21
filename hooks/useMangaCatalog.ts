'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Manga, MangaApiRow } from '@/components/home/types';
import { mapMangaRows } from '@/lib/manga/map';
import { getJSON } from '@/lib/utils';

export function useMangaCatalog(limit = 50) {
  const [mangaList, setMangaList] = useState<Manga[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const json: any = await getJSON(`/api/catalog?limit=${limit}`);
      const rows: MangaApiRow[] = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
      setMangaList(mapMangaRows(rows));
    } catch {
      setMangaList([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => { load(); }, [load]);

  const genres = useMemo(() => {
    const s = new Set<string>();
    mangaList.forEach(m => m.genres?.forEach(g => s.add(g)));
    return Array.from(s).sort();
  }, [mangaList]);

  const topRated = useMemo(() => [...mangaList].sort((a,b)=>b.rating-a.rating).slice(0,6), [mangaList]);

  const recentUpdates = useMemo(() =>
    [...mangaList].sort((a,b)=>{
      const da = a.created_at_iso ? +new Date(a.created_at_iso) : 0;
      const db = b.created_at_iso ? +new Date(b.created_at_iso) : 0;
      return db - da;
    }).slice(0,6)
  , [mangaList]);

  return { mangaList, loading, genres, topRated, recentUpdates, reload: load };
}
