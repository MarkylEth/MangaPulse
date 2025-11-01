// lib/reader/useChapterBundle.ts
import { useEffect, useState } from 'react';
import type { Page, ChapterMeta, TeamInfo } from './types';

type BundleData = {
  pages: Page[];
  meta: ChapterMeta | null;
  teams: TeamInfo[];
  likes: { total: number; likedByMe: boolean };
  bookmark: { page: number } | null;
  userId: string | null;
};

export function useChapterBundle(chapterId: number) {
  const [data, setData] = useState<BundleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chapterId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/reader/chapter/${chapterId}/bundle`, {
      cache: 'no-store',
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;

        setData({
          pages: json.pages || [],
          meta: json.meta || null,
          teams: json.teams || [],
          likes: json.likes || { total: 0, likedByMe: false },
          bookmark: json.bookmark || null,
          userId: json.userId || null,
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || 'Failed to load chapter');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [chapterId]);

  return { data, loading, error };
}