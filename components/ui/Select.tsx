// components/ui/Select.tsx
'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  KeyboardEvent,
} from 'react';

// простая замена clsx
function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
};

type SelectProps<T extends string = string> = {
  value: T | null;
  onChange: (v: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  className?: string;          // классы для триггера
  contentClassName?: string;   // классы для выпадающего меню
  disabled?: boolean;
};

export function Select<T extends string = string>({
  value,
  onChange,
  options,
  placeholder = 'Выберите…',
  className,
  contentClassName,
  disabled,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(() =>
    Math.max(0, options.findIndex((o) => o.value === value))
  );

  const [placement, setPlacement] = useState<'bottom'|'top'>('bottom');
  const [menuMaxHeight, setMenuMaxHeight] = useState<number>(256);
  const [contentHeight, setContentHeight] = useState<number>(0);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const current = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value]
  );

  // клик снаружи — закрываем
  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!listRef.current?.contains(t) && !btnRef.current?.contains(t)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', onMouse);
    return () => window.removeEventListener('mousedown', onMouse);
  }, [open]);

  // вычисляем свободное место и предпочитаемое направление
  const computePlacement = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const vwH = window.innerHeight;
    const margin = 10;          // отступ от краёв
    const desiredCap = 360;     // верхний предел на всякий случай

    const spaceBelow = vwH - rect.bottom - margin;
    const spaceAbove = rect.top - margin;

    // контентная высота (после рендера)
    const ch = contentRef.current?.scrollHeight ?? 0;
    setContentHeight(ch);

    if (spaceBelow >= 200) {
      setPlacement('bottom');
      setMenuMaxHeight(Math.min(desiredCap, spaceBelow));
    } else if (spaceAbove >= spaceBelow) {
      setPlacement('top');
      setMenuMaxHeight(Math.min(desiredCap, spaceAbove));
    } else {
      setPlacement('bottom');
      setMenuMaxHeight(Math.max(160, spaceBelow));
    }
  }, []);

  // при открытии и на ресайз/скролл — пересчёт
  useEffect(() => {
    if (!open) return;
    // сначала измеряем после вставки DOM
    const raf = requestAnimationFrame(() => computePlacement());
    const onResize = () => computePlacement();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [open, computePlacement]);

  const openMenu = useCallback(() => {
    if (disabled) return;
    setActiveIndex(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }, [disabled, options, value]);

  const onKeyDownTrigger = (e: KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openMenu();
    }
  };

  const onKeyDownList = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      btnRef.current?.focus();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(options.length - 1, i + 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const opt = options[activeIndex];
      if (opt) {
        onChange(opt.value);
        setOpen(false);
        btnRef.current?.focus();
      }
    }
  };

  // если контент помещается — убираем прокрутку совсем
  const needScroll = contentHeight > menuMaxHeight;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDownTrigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cx(
          `
          w-full rounded-xl border border-black/10 dark:border-white/10
          bg-white/90 dark:bg-[#0b0e13]/80 backdrop-blur
          text-left text-sm px-3 py-2 h-10
          outline-none focus:ring-2 ring-indigo-500/40
          flex items-center justify-between
        `,
          disabled && 'opacity-60 cursor-not-allowed',
          className
        )}
      >
        <span className={cx('truncate', !current && 'text-gray-500 dark:text-gray-400')}>
          {current?.label ?? placeholder}
        </span>
        <svg className="h-4 w-4 opacity-70" viewBox="0 0 20 20" fill="currentColor">
          <path d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08z"/>
        </svg>
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          onKeyDown={onKeyDownList}
          className={cx(
            `
            absolute left-0 right-0 z-[1100]
            rounded-xl border border-black/10 dark:border-white/10
            bg-white dark:bg-[#0f1115]
            text-sm shadow-2xl
          `,
            placement === 'bottom' ? 'mt-2 top-full' : 'mb-2 bottom-full',
            contentClassName
          )}
        >
          <div
            ref={contentRef}
            className={cx(
              'py-1 pr-1.5',
              needScroll ? 'overflow-y-auto' : 'overflow-visible'
            )}
            style={{
              maxHeight: needScroll ? menuMaxHeight : undefined,
              // Firefox: тонкий светлый скролл в светлой теме
              scrollbarWidth: needScroll ? 'thin' : 'auto',
              scrollbarColor: needScroll ? '#9ca3af transparent' : undefined,
            }}
          >
            {options.map((opt, idx) => {
              const selected = opt.value === value;
              const highlighted = idx === activeIndex;
              return (
                <button
                  key={opt.value}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                    btnRef.current?.focus();
                  }}
                  className={cx(
                    `
                    w-full text-left px-3 py-2
                    text-gray-900 dark:text-zinc-100
                    hover:bg-black/5 dark:hover:bg-white/10
                  `,
                    selected && 'bg-indigo-500/10',
                    highlighted && 'bg-black/5 dark:bg-white/10'
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
