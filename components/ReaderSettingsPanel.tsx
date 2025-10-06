'use client';

import React from 'react';
import { useTheme } from '@/lib/theme/context';
import type { UIReaderSettings } from '@/lib/reader/ui-settings';

// простенький cx вместо clsx
function cx(...p: Array<string | false | null | undefined>) {
  return p.filter(Boolean).join(' ');
}

type Props = {
  open: boolean;
  onClose: () => void;
  settings: UIReaderSettings;
  onChange: (patch: Partial<UIReaderSettings>) => void;
};

export default function ReaderSettingsPanel({ open, onClose, settings, onChange }: Props) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const wrap = cx(
    'fixed top-0 right-0 h-full w-[320px] z-40 transition-transform duration-300 border-l',
    isLight ? 'bg-white text-gray-900 border-gray-200' : 'bg-slate-900 text-white border-slate-800',
    open ? 'translate-x-0' : 'translate-x-full'
  );

  const section = 'space-y-2';
  const title = cx('text-xs font-semibold uppercase tracking-wide',
    isLight ? 'text-gray-600' : 'text-slate-400'
  );
  const row = 'flex flex-wrap gap-2';
  const btn = (active: boolean) =>
    cx(
      'px-3 py-1.5 rounded-md text-sm border transition',
      active
        ? isLight
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-blue-500/20 text-blue-200 border-blue-400/40'
        : isLight
          ? 'bg-white border-gray-200 hover:bg-gray-50'
          : 'bg-white/5 border-white/10 hover:bg-white/10'
    );
  const sliderBox = cx(
    'px-2 py-2 rounded-lg border',
    isLight ? 'bg-white border-gray-200' : 'bg-white/5 border-white/10'
  );
  const label = cx('text-xs', isLight ? 'text-gray-600' : 'text-slate-400');

  return (
    <>
      {/* overlay */}
      <div
        onClick={onClose}
        className={cx(
          'fixed inset-0 z-30 bg-black/40 transition-opacity',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
      />

      {/* panel */}
      <aside className={wrap} role="dialog" aria-modal="true" aria-label="Настройки чтения">
        <div className="p-4 flex items-center justify-between border-b border-white/10">
          <div className="text-base font-semibold">Настройки</div>
          <button
            onClick={onClose}
            className={cx(
              'px-3 py-1.5 rounded-md text-sm border',
              isLight ? 'bg-white border-gray-200 hover:bg-gray-50' : 'bg-white/5 border-white/10 hover:bg-white/10'
            )}
          >
            Закрыть
          </button>
        </div>

        <div className="p-4 space-y-6 overflow-y-auto h-[calc(100%-56px)]">
          {/* режим */}
          <div className={section}>
            <div className={title}>Режим чтения</div>
            <div className={row}>
              <button className={btn(settings.mode === 'horizontal')} onClick={() => onChange({ mode: 'horizontal' })}>Горизонтальный</button>
              <button className={btn(settings.mode === 'vertical')}   onClick={() => onChange({ mode: 'vertical' })}>Вертикальный</button>
              <button className={btn(settings.mode === 'strip')}       onClick={() => onChange({ mode: 'strip' })}>Полоса</button>
            </div>
          </div>

          {/* тема */}
          <div className={section}>
            <div className={title}>Тема чтения</div>
            <div className={row}>
              <button className={btn(settings.theme === 'dark')}   onClick={() => onChange({ theme: 'dark' })}>Тёмная</button>
              <button className={btn(settings.theme === 'light')}  onClick={() => onChange({ theme: 'light' })}>Светлая</button>
              <button className={btn(settings.theme === 'system')} onClick={() => onChange({ theme: 'system' })}>Системная</button>
            </div>
          </div>

          {/* сервер */}
          <div className={section}>
            <div className={title}>Сервер</div>
            <div className={row}>
              <button className={btn(settings.server === 'first')}    onClick={() => onChange({ server: 'first' })}>Первый</button>
              <button className={btn(settings.server === 'second')}   onClick={() => onChange({ server: 'second' })}>Второй</button>
              <button className={btn(settings.server === 'compress')} onClick={() => onChange({ server: 'compress' })}>Сжатие</button>
            </div>
          </div>

          {/* области/зоны */}
          <div className={section}>
            <div className={title}>Область переключения страниц</div>
            <div className={row}>
              <button className={btn(settings.switchArea === 'image')}  onClick={() => onChange({ switchArea: 'image' })}>Изображение</button>
              <button className={btn(settings.switchArea === 'screen')} onClick={() => onChange({ switchArea: 'screen' })}>Весь экран</button>
            </div>
            <div className={row}>
              <button className={btn(settings.zones === 'default')} onClick={() => onChange({ zones: 'default' })}>Зоны по умолчанию</button>
              <button className={btn(settings.zones === 'wide')}    onClick={() => onChange({ zones: 'wide' })}>Широкие зоны</button>
              <button className={btn(settings.zones === 'off')}     onClick={() => onChange({ zones: 'off' })}>Отключить</button>
            </div>
          </div>

          {/* вписывание */}
          <div className={section}>
            <div className={title}>Вместить изображения</div>
            <div className={row}>
              <button className={btn(settings.fit === 'width')}  onClick={() => onChange({ fit: 'width' })}>По ширине</button>
              <button className={btn(settings.fit === 'height')} onClick={() => onChange({ fit: 'height' })}>По высоте</button>
              <button className={btn(settings.fit === 'none')}   onClick={() => onChange({ fit: 'none' })}>Не вписывать</button>
            </div>
          </div>

          {/* увеличение */}
          <div className={section}>
            <div className={title}>Увеличение изображений</div>
            <div className={row}>
              <button className={btn(settings.zoom === 'none')}    onClick={() => onChange({ zoom: 'none' })}>Не увеличивать</button>
              <button className={btn(settings.zoom === 'enlarge')} onClick={() => onChange({ zoom: 'enlarge' })}>Увеличивать</button>
            </div>
          </div>

          {/* слайдеры */}
          <div className="space-y-4">
            <div className={sliderBox}>
              <div className={label}>Яркость {Math.round(settings.brightness)}%</div>
              <input
                type="range"
                min={50}
                max={150}
                value={Math.round(settings.brightness)}
                onChange={(e) => onChange({ brightness: Number(e.target.value) })}
                className="w-full"
              />
            </div>
            <div className={sliderBox}>
              <div className={label}>Ширина контейнера {Math.round(settings.container)}%</div>
              <input
                type="range"
                min={60}
                max={120}
                value={Math.round(settings.container)}
                onChange={(e) => onChange({ container: Number(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>

          {/* чекбоксы */}
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.hidePageNumber}
                onChange={(e) => onChange({ hidePageNumber: e.target.checked })}
              />
              <span className="text-sm">Скрыть номер страниц</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.hotkeys}
                onChange={(e) => onChange({ hotkeys: e.target.checked })}
              />
              <span className="text-sm">Горячие клавиши (←/→)</span>
            </label>
          </div>
        </div>
      </aside>
    </>
  );
}
