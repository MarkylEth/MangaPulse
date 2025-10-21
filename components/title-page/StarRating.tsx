'use client';

import React from 'react';
import { Star } from 'lucide-react';
import { clamp, vibe } from 'lib/utils';

export function StarHalfFill({
  fillPercent, size = 28, active = false,
}: { fillPercent: 0 | 50 | 100; size?: number; active?: boolean }) {
  return (
    <div className="relative inline-block align-middle" style={{ width: size, height: size, willChange: 'transform' }}>
      <Star className="absolute inset-0 text-muted-foreground transition-colors duration-150 ease-out" style={{ width: size, height: size }} />
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${fillPercent}%`, transition: 'width 140ms ease' }}>
        <Star className={active ? 'absolute inset-0 text-amber-400' : 'absolute inset-0 text-amber-400'} style={{ width: size, height: size }} fill="currentColor" />
      </div>
    </div>
  );
}

export function StarRating5({
  value, onChange, className = '', onPreview,
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
  onPreview?: (v: number | null) => void;
}) {
  const [hover, _setHover] = React.useState<number | null>(null);
  const val = clamp(Number.isFinite(value) ? value : 0, 0, 10);
  const shown = hover ?? val;

  const raf = React.useRef<number | null>(null);
  const lastHover = React.useRef<number | null>(null);
  const setHover = (v: number | null) => {
    if (v === lastHover.current) return;
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      lastHover.current = v;
      _setHover(v);
      onPreview?.(v);
    });
  };
  React.useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  function starFillFor(index: number): 0 | 50 | 100 {
    const leftEdge = index * 2 + 1;
    const fullEdge = index * 2 + 2;
    if (shown >= fullEdge) return 100;
    if (shown === leftEdge) return 50;
    return 0;
  }
  function handleMove(e: React.MouseEvent, idx: number) {
    const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
    const half = (e.clientX - rect.left) < rect.width / 2 ? 1 : 2;
    setHover(idx * 2 + half);
  }

  return (
    <div className={`flex items-center gap-1 select-none ${className}`}>
      {Array.from({ length: 5 }, (_, i) => (
        <button
          key={i}
          type="button"
          onMouseMove={(e) => handleMove(e, i)}
          onMouseEnter={(e) => handleMove(e, i)}
          onMouseLeave={() => setHover(null)}
          onClick={(e) => {
            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
            const half = (e.clientX - rect.left) < rect.width / 2 ? 1 : 2;
            const newVal = i * 2 + half;
            onChange(newVal);
            onPreview?.(newVal);
            vibe(8);
          }}
          className="group p-1 rounded focus:outline-none focus:ring-2 focus:ring-accent/50 transition-transform duration-150 ease-out hover:scale-[1.04] active:scale-[0.98]"
          aria-label={`Поставить ${i * 2 + 1} или ${i * 2 + 2} из 10`}
          style={{ willChange: 'transform' }}
        >
          <StarHalfFill fillPercent={starFillFor(i)} size={36} active={shown >= i * 2 + 1} />
        </button>
      ))}
    </div>
  );
}

export function StarRating5Static({ value, className = '' }: { value: number; className?: string }) {
  const v = clamp(value, 0, 10);
  function fillFor(i: number): 0 | 50 | 100 {
    const leftEdge = i * 2 + 1;
    const fullEdge = i * 2 + 2;
    if (v >= fullEdge) return 100;
    if (v >= leftEdge && v < fullEdge) return 50;
    return 0;
  }
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {Array.from({ length: 5 }, (_, i) => (
        <StarHalfFill key={i} fillPercent={fillFor(i)} size={18} />
      ))}
    </div>
  );
}
