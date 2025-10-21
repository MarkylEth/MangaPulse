// components/AddTitleModal.tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/lib/theme/context';
import { Plus } from 'lucide-react';

type Props = {
  /** Кастомный триггер-кнопка. По клику откроется страница /add-title */
  trigger?: React.ReactNode;
  /** Показать дефолтную кнопку, если не передан trigger */
  showDefaultTrigger?: boolean;

  /** Оставлено для совместимости с прежним API модалки — игнорируется визуально */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
};

/**
 * Лёгкий «шим» вместо модалки:
 * - По клику / при open=true перенаправляет на страницу /add-title
 * - Никакого overlay и тяжёлой разметки
 * - Сохраняет совместимость по пропсам
 */
export default function AddTitleModal({
  trigger,
  showDefaultTrigger = false,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter();
  const { theme } = useTheme();

  const go = React.useCallback(() => {
    // на всякий случай закрываем «состояние модалки», если кто-то его ведёт
    onOpenChange?.(false);
    router.push('/add-title');
  }, [onOpenChange, router]);

  // Если кто-то пытается "открыть модалку" через open=true — сразу уводим на страницу
  React.useEffect(() => {
    if (open) go();
  }, [open, go]);

  // Если передан кастомный триггер — кликом ведём на страницу
  if (trigger) {
    return (
      <span onClick={go} className="inline-block cursor-pointer">
        {trigger}
      </span>
    );
  }

  // Дефолтная кнопка-триггер (опционально)
  if (showDefaultTrigger) {
    return (
      <button
        type="button"
        onClick={go}
        aria-label="Добавить тайтл"
        className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-medium text-sm transition-all
          ${theme === 'light'
            ? 'bg-gradient-to-r from-blue-600 to-purple-700 text-white shadow-lg hover:shadow-xl'
            : 'bg-gradient-to-r from-blue-600 to-purple-700 text-white shadow-lg hover:shadow-xl'}`}
      >
        <Plus className="w-4 h-4" />
        Добавить тайтл
      </button>
    );
  }

  // Иначе ничего не рендерим
  return null;
}
