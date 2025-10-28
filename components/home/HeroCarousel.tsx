//components/home/HeroCarousel.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, BookOpen, Info } from 'lucide-react';
import Link from 'next/link';
import type { CarouselItem } from '@/components/home/types';

type Props = {
  items: CarouselItem[];       // массив баннеров
  autoplayMs?: number;         // интервал автопрокрутки (по умолчанию 5000 мс)
  heightClass?: string;        // высота контейнера (Tailwind-класс), по умолчанию 'h-[400px] md:h-[520px]'
}

export default function HeroCarousel({
  items,
  autoplayMs = 5000,
  heightClass = 'h-[400px] md:h-[520px]',
}: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [progress, setProgress] = useState(0); // прогресс точки

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTsRef = useRef<number | null>(null);

  const len = items?.length ?? 0;

  // --------- autoplay + прогресс индикатора ----------
  const clearTimers = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    timerRef.current = null;
    rafRef.current = null;
  };

  const animateProgress = useCallback((duration: number) => {
    startTsRef.current = performance.now();
    const tick = (ts: number) => {
      if (!startTsRef.current) return;
      const elapsed = ts - startTsRef.current;
      setProgress(Math.min(1, elapsed / duration));
      if (elapsed >= duration) return;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (!len || len <= 1) return;

    // при смене слайда — сбрасываем прогресс
    setProgress(0);
    clearTimers();

    if (!isHovered) {
      animateProgress(autoplayMs);
      timerRef.current = setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % len);
      }, autoplayMs) as unknown as NodeJS.Timeout;
    }

    return clearTimers;
  }, [currentIndex, isHovered, len, autoplayMs, animateProgress]);

  // --------- стрелки ----------
  const goToPrevious = () => setCurrentIndex((p) => (p - 1 + len) % len);
  const goToNext = () => setCurrentIndex((p) => (p + 1) % len);
  const goTo = (i: number) => setCurrentIndex(i % len);

  // --------- touch swipe ----------
  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.targetTouches[0].clientX);
  const handleTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);
  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (distance > 50) goToNext();
    if (distance < -50) goToPrevious();
    setTouchStart(0);
    setTouchEnd(0);
  };

  // --------- keyboard nav ----------
  const containerRef = useRef<HTMLDivElement>(null);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') goToPrevious();
    if (e.key === 'ArrowRight') goToNext();
  };

  if (!items || !len) return null;

  const slide = items[currentIndex];

  return (
    <div
      ref={containerRef}
      role="region"
      aria-roledescription="carousel"
      aria-label="Главные баннеры"
      tabIndex={0}
      onKeyDown={onKeyDown}
      className={`relative w-full ${heightClass} rounded-2xl overflow-hidden group outline-none`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* фоновой Ken Burns эффектик + перекаты */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0"
          aria-live="polite"
        >
          <motion.div
            initial={{ scale: 1.08 }}
            animate={{ scale: 1 }}
            transition={{ duration: 6, ease: 'easeOut' }}
            className="absolute inset-0"
          >
            <div
              className="w-full h-full bg-cover bg-center bg-no-repeat will-change-transform"
              style={{ backgroundImage: `url(${slide.coverUrl})` }}
            />
          </motion.div>

          {/* мягкая виниетка и цветовые градиенты */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-transparent" />
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(80%_50%_at_0%_50%,rgba(120,119,198,0.12),transparent)]" />
          </div>

          {/* контент слева */}
          <div className="absolute inset-0 flex items-center">
            <div className="px-6 sm:px-10 lg:px-16 max-w-2xl">
              {/* badge (опционально) */}
              {slide.badge && (
                <motion.div
                  initial={{ y: 12, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                  className="mb-3 inline-flex items-center rounded-full bg-white/10 border border-white/20 px-3 py-1 backdrop-blur"
                >
                  <span className="text-xs font-medium text-white/90">{slide.badge}</span>
                </motion.div>
              )}

              <motion.h2
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white mb-3 leading-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)] line-clamp-2"
              >
                {slide.title}
              </motion.h2>

              {slide.subtitle && (
                <motion.p
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.6 }}
                  className="text-white/80 text-sm md:text-base mb-5 line-clamp-2"
                >
                  {slide.subtitle}
                </motion.p>
              )}

              {/* CTA: «стеклянная» Читать + вторичная Подробнее */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="flex items-center gap-3"
              >
                <Link
                  href={slide.href || '#'}
                  className="
                    inline-flex items-center gap-2 rounded-2xl px-5 py-2.5
                    bg-white/10 hover:bg-white/15 text-white font-semibold
                    border border-white/20 ring-1 ring-white/30 hover:ring-white/40
                    backdrop-blur-md shadow-lg shadow-black/30
                    transition-all hover:translate-y-[-1px] hover:shadow-xl
                    focus:outline-none focus:ring-2 focus:ring-white/50
                  "
                >
                  <BookOpen className="w-5 h-5" />
                  Читать
                </Link>

                {slide.detailsHref && (
                  <Link
                    href={slide.detailsHref}
                    className="
                      inline-flex items-center gap-2 rounded-2xl px-5 py-2.5
                      bg-white/5 hover:bg-white/10 text-white/90
                      border border-white/15 backdrop-blur-sm
                      transition-all hover:translate-y-[-1px]
                      focus:outline-none focus:ring-2 focus:ring-white/30
                    "
                  >
                    <Info className="w-5 h-5" />
                    Подробнее
                  </Link>
                )}
              </motion.div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* стрелки снизу по центру — на мобильных всегда видимы */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
        <motion.button
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.92 }}
          onClick={goToPrevious}
          className="p-3 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full border border-white/20 transition-colors"
          aria-label="Предыдущий слайд"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.92 }}
          onClick={goToNext}
          className="p-3 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full border border-white/20 transition-colors"
          aria-label="Следующий слайд"
        >
          <ChevronRight className="w-5 h-5 text-white" />
        </motion.button>
      </div>
    </div>
  );
}
