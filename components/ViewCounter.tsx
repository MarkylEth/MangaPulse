'use client';
import { useEffect, useState } from 'react';

export default function ViewCounter({ slug }: { slug: string }) {
  const [views, setViews] = useState<number | null>(null);

  useEffect(() => {
    let aborted = false;

    // 1) инкремент без ожидания ответа
    try {
      const url = `/api/views?slug=${encodeURIComponent(slug)}&inc=1`;
      if ('sendBeacon' in navigator) {
        const blob = new Blob([new Uint8Array([1])], { type: 'application/octet-stream' });
        (navigator as any).sendBeacon(url, blob);
      } else {
        fetch(url, { method: 'GET', cache: 'no-store' }).catch(() => {});
      }
    } catch {}

    // 2) подтянуть текущее значение
    fetch(`/api/views?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (!aborted) setViews(j?.views ?? 0); })
      .catch(() => { if (!aborted) setViews(0); });

    return () => { aborted = true; };
  }, [slug]);

  if (views === null) return null;
  return <span className="text-xs opacity-70">Просмотры: {views}</span>;
}
