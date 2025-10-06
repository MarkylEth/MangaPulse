// lib/reader/settings.ts
export type ReaderSettings = {
  // UI
  mode: 'horizontal' | 'vertical' | 'strip';
  theme: 'dark' | 'light' | 'system';
  // CDN/сервер
  server: 'first' | 'second' | 'compress';
  // Переключение страниц
  zones: 'default' | 'wide' | 'off';      // зоны нажатия
  area: 'image' | 'screen';               // где листать
  // Рендер изображений
  fit: 'width' | 'height' | 'none';       // вместить по ширине/высоте
  zoom: 'none' | 'enlarge';               // увеличивать по клику
  // Слайдеры
  brightness: number;                     // 0.5..1.5
  container: number;                      // 60..120 (%)
  // Прочее
  hidePageNumber: boolean;
  hotkeys: boolean;
};

export const SETTINGS_KEY = 'mp:reader:settings';

export const DEFAULT_SETTINGS: ReaderSettings = {
  mode: 'horizontal',
  theme: 'system',
  server: 'first',
  zones: 'default',
  area: 'image',
  fit: 'width',
  zoom: 'none',
  brightness: 1,
  container: 100,
  hidePageNumber: false,
  hotkeys: true,
};

export function loadReaderSettings(): ReaderSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const merged = { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) || {}) } as ReaderSettings;
    // привести числа в допустимые рамки
    merged.brightness = Math.min(1.5, Math.max(0.5, Number(merged.brightness || 1)));
    merged.container = Math.min(120, Math.max(60, Number(merged.container || 100)));
    return merged;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveReaderSettings(s: ReaderSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {}
}
