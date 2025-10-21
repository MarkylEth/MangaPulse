// lib/libraryQueue.ts
'use client';

type LibStatus = 'planned' | 'reading' | 'completed' | 'dropped';

export type LibraryIntent = {
  manga_id: number;
  favorite?: boolean | null;
  status?: LibStatus | null;
  updated_at: number;
};

const STORAGE_KEY = 'library_intents_v1';
const FLUSH_INTERVAL_MS = 7000;
const MAX_BATCH = 200;

function canUseStorage() {
  try { return typeof window !== 'undefined' && !!window.localStorage; } catch { return false; }
}

function now() { return Date.now(); }

class LibraryQueue {
  private byId = new Map<number, LibraryIntent>();
  private flushing = false;
  private timer: any = null;

  constructor() {
    if (canUseStorage()) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const arr: LibraryIntent[] = JSON.parse(raw);
          arr.forEach(it => this.byId.set(it.manga_id, it));
        }
      } catch {}
    }

    // флашим при скрытии вкладки / уходе
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this.flush({ beacon: true });
      });
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', () => this.flush({ beacon: true }));
      window.addEventListener('beforeunload', () => this.flush({ beacon: true }));
    }

    // периодический флаш
    this.armTimer();
  }

  /** Добавить/обновить намерение (схлопывает клики в итоговое состояние) */
  upsert(partial: Omit<LibraryIntent, 'updated_at'>) {
    const prev = this.byId.get(partial.manga_id);
    const merged: LibraryIntent = {
      manga_id: partial.manga_id,
      favorite: partial.favorite ?? prev?.favorite ?? null,
      status:   partial.status   ?? prev?.status   ?? null,
      updated_at: now(),
    };
    this.byId.set(partial.manga_id, merged);
    this.persist();
    this.armTimer();
  }

  /** Слить очередь на сервер пачкой */
  async flush(opts: { beacon?: boolean } = {}) {
    if (this.flushing || this.byId.size === 0) return;
    this.flushing = true;

    const items = Array.from(this.byId.values())
      .sort((a,b)=>a.manga_id-b.manga_id)
      .slice(0, MAX_BATCH);

    if (items.length === 0) { this.flushing = false; return; }

    const body = JSON.stringify({ items });

    try {
      if (opts.beacon && typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
        const blob = new Blob([body], { type: 'application/json' });
        (navigator as any).sendBeacon('/api/library/bulk', blob);
        // предполагаем успешную доставку → очищаем эти элементы локально
        items.forEach(it => this.byId.delete(it.manga_id));
        this.persist();
      } else {
        const res = await fetch('/api/library/bulk', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
        if (!res.ok) throw new Error(`bulk_failed_${res.status}`);
        items.forEach(it => this.byId.delete(it.manga_id));
        this.persist();
      }
    } catch {
      // оставляем intents — повторим в следующий раз
    } finally {
      this.flushing = false;
      this.armTimer();
    }
  }

  /** Принудительный флаш (например, после серии кликов) */
  flushSoon(delayMs = 1000) {
    setTimeout(() => this.flush(), delayMs);
  }

  private persist() {
    if (!canUseStorage()) return;
    try {
      const arr = Array.from(this.byId.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch {}
  }

  private armTimer() {
    if (this.timer) return;
    if (this.byId.size === 0) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, FLUSH_INTERVAL_MS);
  }
}

export const libraryQueue = new LibraryQueue();
