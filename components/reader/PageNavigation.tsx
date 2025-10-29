// components/reader/PageNavigation.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Page } from '@/lib/reader/types';

interface PageNavigationProps {
  pages: Page[];
  index: number;
  onPageChange: (index: number) => void;
}

export default function PageNavigation({ pages, index, onPageChange }: PageNavigationProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pagePickerRef = useRef<HTMLDivElement>(null);

  const pageToShow = index + 1;

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    
    const onClick = (e: MouseEvent) => {
      if (!pagePickerRef.current?.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickerOpen(false);
    };

    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [pickerOpen]);

  // Auto-scroll to current page in picker
  useEffect(() => {
    if (!pickerOpen) return;
    const el = document.querySelector('[data-current-page="true"]') as HTMLElement;
    if (el) el.scrollIntoView({ block: 'center' });
  }, [pickerOpen]);

  return (
    <div className="flex items-center justify-center">
      <div className="relative" ref={pagePickerRef}>
        <button
          onClick={() => setPickerOpen((v) => !v)}
          className="px-3 py-1.5 rounded-full bg-[#2a2a2a] border border-[#3a3a3a] shadow-sm hover:bg-[#333333] text-[#e5e7eb] focus-visible:outline-none focus-visible:ring-2 ring-white/10 inline-flex items-center gap-1"
          aria-expanded={pickerOpen}
        >
          Стр. {pageToShow}/{pages.length}
          <ChevronDown className="w-4 h-4 opacity-70" />
        </button>

        {pickerOpen && (
          <div className="absolute left-1/2 -translate-x-1/2 z-50 mt-2 w-[22rem] sm:w-[24rem] rounded-2xl border border-[#2a2a2a] shadow-2xl backdrop-blur bg-[#1f1f1f]/95">
            <div className="max-h-72 overflow-y-auto px-3 py-3">
              <div className="grid grid-cols-10 gap-1">
                {pages.map((_, i) => {
                  const active = i === index;
                  return (
                    <button
                      key={i}
                      data-current-page={active ? 'true' : undefined}
                      onClick={() => {
                        onPageChange(i);
                        setPickerOpen(false);
                      }}
                      className={`h-9 rounded-lg text-sm tabular-nums transition ${
                        active
                          ? 'bg-white text-black shadow-inner'
                          : 'bg-[#2a2a2a] border border-[#3a3a3a] hover:bg-[#333333] text-[#e5e7eb]'
                      }`}
                      title={`Стр. ${i + 1}`}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}