'use client';

import React from 'react';
import { X } from 'lucide-react';
import { clamp, vibe } from 'lib/utils';
import { StarRating5 } from './StarRating';

export default function RatingModalLinear({
  open, value, onChange, onClose, onSave,
}: {
  open: boolean;
  value: number | null;
  onChange: (v: number) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const v = clamp(value ?? 7, 1, 10);
  const [preview, setPreview] = React.useState<number | null>(null);
  const display = clamp(preview ?? v, 1, 10);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') { onChange(clamp(v - 1, 1, 10)); vibe(); }
      if (e.key === 'ArrowRight') { onChange(clamp(v + 1, 1, 10)); vibe(); }
      if (/^[0-9]$/.test(e.key)) {
        const to = e.key === '0' ? 10 : Number(e.key);
        onChange(clamp(to, 1, 10)); vibe();
      }
      if (e.key === 'Enter') onSave();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, v, onChange, onClose, onSave]);

  if (!open) return null;

  const labels = ['ужасно','плохо','слабовато','такое','норм','ок','хорошо','круто','топ','шедевр'];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm md:backdrop-blur" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md rounded-2xl bg-card/90 backdrop-blur-xl border border-border p-5 md:p-6 shadow-[0_20px_80px_rgba(0,0,0,.6)]">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-semibold text-foreground">Оценить тайтл</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-center">
            <StarRating5 value={v} onChange={(nv) => { onChange(nv); }} onPreview={setPreview} />
          </div>
          <div className="mt-3 text-center">
            <div className="text-5xl font-bold leading-none tabular-nums text-foreground">{display}</div>
            <div className="mt-1 text-xs text-muted-foreground">{labels[display - 1]}</div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={() => { onSave(); vibe(20); }}
            className="group relative px-5 py-2.5 rounded-xl bg-muted border border-border backdrop-blur hover:opacity-90 transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
            aria-label="Сохранить оценку"
          >
            <span className="text-sm font-semibold tracking-wide text-foreground">Сохранить</span>
          </button>
        </div>
      </div>
    </div>
  );
}
