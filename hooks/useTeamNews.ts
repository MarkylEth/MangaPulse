'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TeamNewsItem } from '@/components/home/types';

export function useTeamNews(limit = 4) {
  const [items, setItems] = useState<TeamNewsItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/news?limit=${limit}`, { cache: 'no-store', credentials: 'include' });
      const json: any = await r.json();
      setItems(Array.isArray(json?.data) ? json.data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => { load(); }, [load]);

  return { items, loading, reload: load };
}

export function useCanPostNews() {
  const [can, setCan] = useState(false);
  useEffect(() => {
    fetch('/api/news/can-post', { cache: 'no-store', credentials: 'include' })
      .then(r => r.ok ? r.json() : { canPost: false })
      .then((j: any) => setCan(Boolean(j?.canPost)))
      .catch(() => setCan(false));
  }, []);
  return can;
}
