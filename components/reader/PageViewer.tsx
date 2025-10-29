// components/reader/PageViewer.tsx
'use client';

import React from 'react';
import type { Page } from '@/lib/reader/types';

interface PageViewerProps {
  page: Page;
  index: number;
  onPrev: () => void;
  onNext: () => void;
}

export default function PageViewer({ page, index, onPrev, onNext }: PageViewerProps) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-black text-white border border-black">
      <img
        src={page.url}
        alt={`page-${index + 1}`}
        className="w-full h-auto select-none"
        draggable={false}
        loading="eager"
        decoding="async"
        fetchPriority="high"
      />
      <button
        onClick={onPrev}
        className="group absolute inset-y-0 left-0 w-1/2 focus:outline-none"
        aria-label="Previous page"
      />
      <button
        onClick={onNext}
        className="group absolute inset-y-0 right-0 w-1/2 focus:outline-none"
        aria-label="Next page"
      />
    </div>
  );
}