'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChapterFeedItem } from '@/components/home/types';
import { getJSON } from '@/lib/utils';

export function useChapterFeed(initialLimit = 24) {
  const [items, setItems] = useState<ChapterFeedItem[]>([]);
  const [connected, setConnected] = useState<'sse'|'poll'|'none'>('none');
  const seen = useRef(new Set<string>());
  const isDebug = typeof window !== 'undefined' && /(^|[?&])debug=1(&|$)/.test(location.search);

  const normalize = useCallback((raw: any): ChapterFeedItem[] => {
    const src = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const out: ChapterFeedItem[] = [];
    for (const r of src) {
      if (!r) continue;
      const idRaw = r.chapter_id ?? r.id; if (idRaw == null) continue;
      const id = String(idRaw).trim(); if (!id) continue;
      const createdRaw = r.created_at ?? r.createdAt; if (!createdRaw) continue;
      const created = String(createdRaw); if (Number.isNaN(new Date(created).getTime())) continue;
      out.push({
        chapter_id: id,
        manga_id: r.manga_id ?? r.title_id ?? r.mangaId,
        manga_title: r.manga_title ?? r.mangaTitle ?? '(без названия)',
        chapter_number: r.chapter_number ?? r.number ?? null,
        volume: r.volume ?? r.vol_number ?? r.volume_number ?? null,
        created_at: created,
        cover_url: r.cover_url ?? r.coverUrl ?? null,
        team_name: r.team_name ?? r.teamName ?? null,
        team_slug: r.team_slug ?? r.teamSlug ?? null,
      });
    }
    out.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    if (isDebug) console.log('[feed] normalize →', out.length, out);
    return out;
  }, [isDebug]);

  const upsert = useCallback((arr: ChapterFeedItem[]) => {
    if (!arr?.length) return;
    setItems((prev) => {
      const next = [...prev];
      for (const it of arr) {
        const key = String(it.chapter_id);
        if (!seen.current.has(key)) { seen.current.add(key); next.unshift(it); }
      }
      next.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
      return next.slice(0, 30);
    });
  }, []);

  const loadInitial = useCallback(async () => {
    try {
      const json: any = await getJSON(`/api/chapters/latest?limit=${initialLimit}`);
      const payload =
        Array.isArray(json?.data)  ? json.data  :
        Array.isArray(json?.items) ? json.items :
        Array.isArray(json)        ? json       : [];
      upsert(normalize(payload));
    } catch (e) {
      console.warn('[feed] initial load failed', e);
    }
  }, [initialLimit, normalize, upsert]);

  useEffect(() => {
    let closed = false;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    const connect = () => {
      if (closed) return;
      try {
        const es = new EventSource(`/api/chapters/stream?limit=${initialLimit}`);
        es.onopen = () => { setConnected('sse'); reconnectAttempts = 0; if (isDebug) console.log('[feed] SSE opened'); };
        es.onerror = () => {
          es.close();
          if (!closed) {
            setConnected('poll');
            if (reconnectAttempts < maxReconnectAttempts) {
              reconnectAttempts++;
              const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
              if (isDebug) console.log(`[feed] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
              setTimeout(connect, delay);
            }
          }
        };
        es.onmessage = (ev) => {
          try {
            const parsed = JSON.parse(ev.data);
            const payload =
              Array.isArray(parsed?.data)  ? parsed.data  :
              Array.isArray(parsed?.items) ? parsed.items :
              Array.isArray(parsed)        ? parsed       : [];
            upsert(normalize(payload));
          } catch (err) {
            if (isDebug) console.warn('[feed] SSE parse error', err);
          }
        };
        return es;
      } catch { setConnected('poll'); return null; }
    };

    loadInitial();
    const es = connect();
    return () => { closed = true; if (es) es.close(); };
  }, [normalize, upsert, loadInitial, isDebug, initialLimit]);

  return { items, connected };
}
