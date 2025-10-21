// lib/utils.ts
// Маленькие утилиты без внешних зависимостей + сетевые/локализационные хелперы

// ============================================================================
// БАЗОВЫЕ УТИЛИТЫ
// ============================================================================
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function assert(cond: any, msg = 'Assertion failed'): asserts cond {
  if (!cond) throw new Error(msg);
}

export function defined<T>(v: T | null | undefined): v is T {
  return v !== null && v !== undefined;
}

/** безопасный парс числа из query/форм */
export function toInt(v: unknown, d = 0) {
  const n = Number(String(v ?? '').trim());
  return Number.isFinite(n) ? Math.trunc(n) : d;
}

/** объект -> querystring без пустых */
export function toQuery(params: Record<string, any>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    sp.set(k, String(v));
  });
  return sp.toString();
}

/** склейка классов */
export function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

/** нормализация “списка” из строки/массива */
export function asList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s || /^empty$/i.test(s)) return [];
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return asList(parsed);
    } catch { /* ignore */ }
    return s.split(/[,;]\s*|\r?\n/g).map((x) => x.trim()).filter(Boolean);
  }
  return [];
}

/** простое человеко-понятное время "N мин/час/дн назад" */
export function formatTimeAgo(iso: string): string {
  const dt = new Date(iso);
  const diff = Date.now() - dt.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec} сек назад`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин назад`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ч назад`;
  const d = Math.floor(hr / 24);
  return `${d} дн назад`;
}

// ============================================================================
// ЧИСЛОВЫЕ/ДРУГИЕ ХЕЛПЕРЫ
// ============================================================================
export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(n, max));
}

export function vibe(ms = 10) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { (navigator as any).vibrate(ms); } catch {}
  }
}

export function getVol(ch: { vol_number?: number | null }): number | null {
  const v = Number(ch.vol_number ?? NaN);
  return Number.isFinite(v) ? v : null;
}

// ============================================================================
/* ЛОКАЛИЗАЦИЯ */
// ============================================================================
export const STATUS_RU: Record<string, string> = {
  ongoing: 'Выпускается',
  completed: 'Завершён',
  paused: 'Приостановлен',
};

export const TR_STATUS_RU: Record<string, string> = {
  ongoing: 'Продолжается',
  'on-going': 'Продолжается',
  продолжается: 'Продолжается',
  completed: 'Завершён',
  завершен: 'Завершён',
  завершён: 'Завершён',
  dropped: 'Заброшен',
  abandoned: 'Заброшен',
  заброшен: 'Заброшен',
  on_hold: 'Заморожен',
  hiatus: 'Заморожен',
  заморожен: 'Заморожен',
};

export const TYPE_RU: Record<string, string> = {
  manga: 'манга', манга: 'Манга',
  manhwa: 'манхва', манхва: 'Манхва',
  manhua: 'маньхуа', маньхуа: 'Маньхуа',
  other: 'другое', другое: 'Другое',
};

/** фикс сигнатуры: обязательные параметры не идут после optional */
export function toRu(
  map: Record<string, string>,
  val: string | null | undefined,
  fallback: string
) {
  if (!val) return fallback;
  const key = String(val).toLowerCase();
  return map[key] ?? fallback;
}

// ============================================================================
// JSON / FETCH УТИЛИТЫ (ОБЪЕДИНЁННЫЕ)
// ============================================================================

/** Синхронный безопасный парс строки -> JSON с фолбэком */
export function safeParseJson<T = any>(val: unknown, fallback: T): T {
  try {
    if (typeof val === 'string') return JSON.parse(val) as T;
  } catch { /* ignore */ }
  return fallback;
}

/** Парсит Response как JSON, возвращает null если не JSON/пусто */
export async function safeJson<T = any>(res: Response): Promise<T | null> {
  const ct = res.headers.get('content-type') || '';
  const txt = await res.text();
  if (!txt) return null;
  if (ct.includes('application/json')) {
    try { return JSON.parse(txt) as T; } catch { return null; }
  }
  return null;
}

/** Альяс-имя, если удобнее */
export const safeJsonResponse = async <T = any>(res: Response) => safeJson<T>(res);

/** Удобный JSON-фетчер с no-store + credentials; возвращает {} при ошибке */
export async function getJson(url: string) {
  try {
    const r = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' }, credentials: 'include' });
    const data = await safeJson<any>(r);
    return r.ok ? (data ?? {}) : {};
  } catch { return {}; }
}

/** Пытается загрузить JSON с fallback на несколько URL */
export async function tryJson(urls: string[], init?: RequestInit): Promise<any> {
  for (const url of urls) {
    try {
      const res = await fetch(url, { ...init, credentials: 'include', cache: 'no-store' });
      if (res.status === 404) continue;
      if (!res.ok) continue;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) return await res.json();
      return null;
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.debug(`[tryJson] Failed to fetch ${url}:`, err);
      }
      continue;
    }
  }
  return null;
}

/** Проверяет, доступен ли хотя бы один URL из списка (2xx) */
export async function tryOk(urls: string[], init?: RequestInit): Promise<boolean> {
  for (const url of urls) {
    try {
      const res = await fetch(url, { ...init, credentials: 'include', cache: 'no-store' });
      if (res.status === 404) continue;
      if (res.ok) return true;
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.debug(`[tryOk] Failed to fetch ${url}:`, err);
      }
      continue;
    }
  }
  return false;
}

/** Жёсткий загрузчик JSON c одного URL (кидает ошибку при проблеме) */
export async function fetchJson<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Expected JSON, got ${contentType}`);
  }
  return (await res.json()) as T;
}

/** Типобезопасная версия tryJson с валидатором структуры */
export async function tryJsonSafe<T>(
  urls: string[],
  init?: RequestInit,
  validator?: (data: any) => data is T
): Promise<T | null> {
  const data = await tryJson(urls, init);
  if (data === null) return null;
  if (validator && !validator(data)) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[tryJsonSafe] Data failed validation:', data);
    }
    return null;
  }
  return data as T;
}

/** Ещё один унифицированный JSON fetcher (кидает ошибку при !ok/!json) */
export async function getJSON<T = any>(input: RequestInfo | URL, init: RequestInit = {}) {
  const r = await fetch(input, { cache: 'no-store', credentials: 'include', ...init });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const ct = r.headers.get('content-type') || '';
  if (!ct.includes('application/json')) throw new Error(`Expected JSON, got ${ct}`);
  return r.json() as Promise<T>;
}
