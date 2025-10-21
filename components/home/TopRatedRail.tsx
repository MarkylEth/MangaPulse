'use client';

import type { Manga } from '@/components/home/types';
import LiveCard from './LiveCard';

export default function TopRatedRail({ items }: { items: Manga[] }) {
  const base = items.length < 5
    ? [...items, ...items.slice(0, Math.max(0, 5 - items.length))]
    : items;

  const repeatedItems = [...base, ...base, ...base, ...base];
  const durationSec = base.length * 8;

  return (
    <div className="group relative w-full overflow-hidden rounded-xl border border-border/40 bg-card/30">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-background to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background to-transparent z-10" />

      <div className="flex">
        <div
          className="mp-rail flex gap-4 py-3"
          style={{ '--marquee-duration': `${durationSec}s` } as React.CSSProperties}
        >
          {repeatedItems.map((m, idx) => (
            <div key={`item-${m.id}-${idx}`} className="flex-none shrink-0 w-64 md:w-72">
              <LiveCard manga={m} />
            </div>
          ))}
        </div>
      </div>

      <style jsx global>{`
        @keyframes mp-marquee { 0% { transform: translate3d(0,0,0);} 100% { transform: translate3d(-25%,0,0);} }
        .mp-rail { animation: mp-marquee var(--marquee-duration) linear infinite; will-change: transform; backface-visibility: hidden; perspective: 1000px; }
        .group:hover .mp-rail { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) { .mp-rail { animation: none !important; transform: none !important; } }
      `}</style>
    </div>
  );
}
