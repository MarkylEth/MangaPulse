// lib/reader/ui-settings.ts
export type UIReaderSettings = {
  // UI режим
  mode: 'horizontal' | 'vertical' | 'strip';
  theme: 'dark' | 'light' | 'system';

  // CDN/сервер
  server: 'first' | 'second' | 'compress';

  // Переключение страниц
  zones: 'default' | 'wide' | 'off';     // ширина кликабельных зон или выключено
  switchArea: 'image' | 'screen';        // «изображение» или «весь экран»

  // Вписывание изображений
  fit: 'width' | 'height' | 'none';

  // Увеличение
  zoom: 'none' | 'enlarge';

  // Слайдеры (в процентах)
  brightness: number;   // 50..150 (%)
  container: number;    // 60..120 (%)

  // Прочее
  hidePageNumber: boolean;
  hotkeys: boolean;
};

export const DEFAULT_UI_SETTINGS: UIReaderSettings = {
  mode: 'horizontal',
  theme: 'system',
  server: 'first',
  zones: 'wide',
  switchArea: 'image',
  fit: 'width',
  zoom: 'none',
  brightness: 100,
  container: 100,
  hidePageNumber: false,
  hotkeys: true,
};
