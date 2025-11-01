// app/(admin)/admin/ChapterReviewPanel.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTheme } from '@/lib/theme/context';
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  BookOpen,
  Clock,
  Square,
  CheckSquare,
  MinusSquare,
  Eye,
  X,
  Image as ImageIcon,
} from 'lucide-react';

/* ===================== types ===================== */
type QueueItem = {
  id: number;
  manga_id: number;
  chapter_number: number;
  volume: number;
  title: string;
  status: 'ready' | 'draft' | string;
  pages_count: number;
  created_at: string;

  // доп. поля, если бэк их присылает (опционально)
  volume_number?: number | null;
  vol_number?: number | null;

  uploaded_by?: string | null;   // UUID
  user_id?: string | null;       // UUID (совместимость)
  created_by?: string | null;    // UUID (если используешь это)
  uploader_name?: string | null; // ЧПУ-имя/ник
  username?: string | null;
  user_name?: string | null;
  author_name?: string | null;

  manga_title?: string | null;
  manga_slug?: string | null;
};

type ApiList<T> = { ok?: boolean; items?: T[]; message?: string };

type WorkingState = 'approve' | 'reject' | 'done' | 'error' | undefined;

/* ===================== utils ===================== */
async function safeJson<T>(res: Response): Promise<T | null> {
  const ct = res.headers.get('content-type') || '';
  const text = await res.text();
  if (!text) return null;
  if (ct.includes('application/json')) {
    try { return JSON.parse(text) as T; } catch { return null; }
  }
  return null;
}

function fmtDate(s: string) {
  try { return new Date(s).toLocaleString('ru-RU'); } catch { return s; }
}

const isReady = (q: QueueItem) => String(q.status).toLowerCase() === 'ready';

function pickVolume(q: QueueItem): number | null {
  const anyq = q as any;
  return q.volume ?? anyq.volume_number ?? anyq.vol_number ?? null;
}
function pickUploaderName(q: QueueItem): string | undefined {
  const anyq = q as any;
  return anyq.uploader_name || anyq.user_name || anyq.username || anyq.author_name || undefined;
}
function pickUploaderId(q: QueueItem): string | undefined {
  const anyq = q as any;
  return anyq.uploaded_by || anyq.user_id || anyq.created_by || undefined;
}
function shortId(id?: string) {
  return id ? id.replace(/-/g, '').slice(0, 8) : undefined;
}

const PUB_BASE = (process.env.NEXT_PUBLIC_R2_PUBLIC_BASE as string | undefined)?.replace(/\/$/, '') || '';

/* ===================== UI ===================== */
export default function ChapterReviewPanel() {
  const { theme } = useTheme();

  const bg = theme === 'light' ? 'bg-gray-50 text-gray-900' : 'text-gray-100';
  const card = theme === 'light'
    ? 'bg-white border border-gray-200'
    : 'bg-slate-900/50 border border-white/10';
  const muted = theme === 'light' ? 'text-gray-600' : 'text-slate-400';
  const btn = theme === 'light'
    ? 'inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 text-gray-900'
    : 'inline-flex items-center gap-2 rounded-lg border border-white/10 bg-slate-800/70 hover:bg-slate-700 text-white';
  const approveBtn = theme === 'light'
    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
    : 'bg-emerald-500 hover:bg-emerald-400 text-black';
  const rejectBtn = theme === 'light'
    ? 'bg-rose-600 hover:bg-rose-500 text-white'
    : 'bg-rose-500 hover:bg-rose-400 text-black';

  const [loading, setLoading] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null); // single-action busy

  // === selection state ===
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [working, setWorking] = useState<Record<number, WorkingState>>({});

  // === preview state ===
  const [preview, setPreview] = useState<QueueItem | null>(null);

  const total = queue.length;
  const readyCount = useMemo(() => queue.filter(isReady).length, [queue]);
  const selectedCount = selected.size;
  const selectedItems = useMemo(() => queue.filter(q => selected.has(q.id)), [queue, selected]);
  const selectedReadyCount = selectedItems.filter(isReady).length;
  const allSelected = selectedCount > 0 && selectedCount === total && total > 0;
  const someSelected = selectedCount > 0 && selectedCount < total;

  async function refresh() {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/chapters/pending', { credentials: 'include' });
      const j = (await safeJson<ApiList<QueueItem>>(r)) || {};
      if (!r.ok) throw new Error(j.message || `HTTP ${r.status}`);
      const items = Array.isArray(j.items) ? j.items : [];
      setQueue(items);
      // синхронизируем выделение (оставляем только существующие id)
      setSelected(prev => new Set(Array.from(prev).filter(id => items.some(x => x.id === id))));
    } catch (e: any) {
      alert(e?.message || 'Не удалось загрузить очередь');
      setQueue([]);
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  function toggleOne(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function selectAll() { setSelected(new Set(queue.map(q => q.id))); }
  function clearSelection() { setSelected(new Set()); }
  function selectReadyOnly() { setSelected(new Set(queue.filter(isReady).map(q => q.id))); }
  function toggleAll() { if (allSelected) clearSelection(); else selectAll(); }

  async function approve(chapterId: number) {
    if (busyId || bulkBusy) return;
    setBusyId(chapterId);
    try {
      const r = await fetch('/api/admin/chapters/publish', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterId, deleteStaging: true }),
      });
      const j = await safeJson<{ ok?: boolean; message?: string }>(r);
      if (!r.ok || j?.ok === false) throw new Error(j?.message || `HTTP ${r.status}`);
      setQueue(q => q.filter(x => x.id !== chapterId));
      setSelected(prev => { const next = new Set(prev); next.delete(chapterId); return next; });
    } catch (e: any) {
      alert(e?.message || 'Ошибка публикации');
    } finally {
      setBusyId(null);
    }
  }

  async function reject(chapterId: number) {
    if (busyId || bulkBusy) return;
    const reason = prompt('Причина отклонения (необязательно):') || '';
    setBusyId(chapterId);
    try {
      const r = await fetch('/api/admin/chapters/reject', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterId, reason }),
      });
      const j = await safeJson<{ ok?: boolean; message?: string }>(r);
      if (!r.ok || j?.ok === false) throw new Error(j?.message || `HTTP ${r.status}`);
      setQueue(q => q.filter(x => x.id !== chapterId));
      setSelected(prev => { const next = new Set(prev); next.delete(chapterId); return next; });
    } catch (e: any) {
      alert(e?.message || 'Ошибка отклонения');
    } finally {
      setBusyId(null);
    }
  }

  async function approveSelected() {
    if (bulkBusy || selectedCount === 0) return;
    const targets = selectedItems.filter(isReady).map(q => q.id);
    const skipped = selectedCount - targets.length;
    if (targets.length === 0) {
      alert('Среди выбранных нет глав в статусе ready');
      return;
    }
    if (!confirm(`Опубликовать ${targets.length} глав?${skipped > 0 ? ` (пропускаем ${skipped} не ready)` : ''}`)) return;

    setBulkBusy(true);
    setBulkProgress(0);

    try {
      for (let i = 0; i < targets.length; i++) {
        const id = targets[i];
        setWorking(prev => ({ ...prev, [id]: 'approve' }));
        try {
          const r = await fetch('/api/admin/chapters/publish', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chapterId: id, deleteStaging: true }),
          });
          const j = await safeJson<{ ok?: boolean; message?: string }>(r);
          if (!r.ok || j?.ok === false) throw new Error(j?.message || `HTTP ${r.status}`);
          setQueue(q => q.filter(x => x.id !== id));
          setSelected(prev => { const next = new Set(prev); next.delete(id); return next; });
          setWorking(prev => ({ ...prev, [id]: 'done' }));
        } catch {
          setWorking(prev => ({ ...prev, [id]: 'error' }));
        }
        setBulkProgress(Math.round(((i + 1) / targets.length) * 100));
      }
    } finally {
      setBulkBusy(false);
    }
  }

  async function rejectSelected() {
    if (bulkBusy || selectedCount === 0) return;
    const reason = prompt('Причина отклонения для выбранных (необязательно):') || '';
    if (!confirm(`Отклонить ${selectedCount} выбранных глав?`)) return;

    setBulkBusy(true);
    setBulkProgress(0);

    const ids = Array.from(selected);
    try {
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        setWorking(prev => ({ ...prev, [id]: 'reject' }));
        try {
          const r = await fetch('/api/admin/chapters/reject', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chapterId: id, reason }),
          });
          const j = await safeJson<{ ok?: boolean; message?: string }>(r);
          if (!r.ok || j?.ok === false) throw new Error(j?.message || `HTTP ${r.status}`);
          setQueue(q => q.filter(x => x.id !== id));
          setSelected(prev => { const next = new Set(prev); next.delete(id); return next; });
          setWorking(prev => ({ ...prev, [id]: 'done' }));
        } catch {
          setWorking(prev => ({ ...prev, [id]: 'error' }));
        }
        setBulkProgress(Math.round(((i + 1) / ids.length) * 100));
      }
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <section className={bg}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-semibold">Приёмка глав</h2>
          <div className={`text-sm ${muted}`}>
            В очереди: {total || 0} · готовых к публикации: {readyCount}
            {selectedCount > 0 && (
              <>
                <span className="mx-2">•</span>
                Выбрано: {selectedCount}{selectedReadyCount !== selectedCount ? ` (ready: ${selectedReadyCount})` : ''}
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* selection controls */}
          <button className={`${btn} px-3 py-2`} onClick={toggleAll} disabled={loading || bulkBusy || total === 0} title={allSelected ? 'Снять выделение' : 'Выделить всё'}>
            {allSelected ? <CheckSquare className="h-4 w-4" /> : someSelected ? <MinusSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            {allSelected ? 'Снять всё' : 'Выбрать всё'}
          </button>
          <button className={`${btn} px-3 py-2`} onClick={selectReadyOnly} disabled={loading || bulkBusy || readyCount === 0} title="Выделить только готовые (ready)">
            Ready
          </button>
          <button className={`${btn} px-3 py-2`} onClick={clearSelection} disabled={loading || bulkBusy || selectedCount === 0} title="Очистить выделение">
            Сброс
          </button>

          {/* bulk actions */}
          <button className={`px-3 py-2 rounded-lg inline-flex items-center gap-2 ${approveBtn}`} disabled={bulkBusy || selectedReadyCount === 0} onClick={approveSelected} title={selectedReadyCount ? 'Одобрить выбранные ready' : 'Нет выбранных ready'}>
            <CheckCircle2 className="h-4 w-4" />
            Одобрить выбранные
          </button>
          <button className={`px-3 py-2 rounded-lg inline-flex items-center gap-2 ${rejectBtn}`} disabled={bulkBusy || selectedCount === 0} onClick={rejectSelected} title="Отклонить выбранные">
            <XCircle className="h-4 w-4" />
            Отклонить выбранные
          </button>

          {/* refresh */}
          <button className={`${btn} px-3 py-2`} disabled={loading || bulkBusy} onClick={() => refresh()} title="Обновить">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Обновить
          </button>
        </div>
      </div>

      {bulkBusy && (
        <div className="mb-3 rounded-lg border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/[0.03] px-3 py-2 text-sm">
          <div className={`mb-1 ${muted}`}>Групповая операция… {bulkProgress}%</div>
          <div className="h-2 w-full rounded bg-black/10 dark:bg-white/10">
            <div className="h-2 rounded bg-emerald-500 transition-all" style={{ width: `${bulkProgress}%` }} />
          </div>
        </div>
      )}

      {loading && (
        <div className={`text-sm ${muted}`}>Загрузка…</div>
      )}

      {!loading && queue.length === 0 && (
        <div className={`text-sm ${muted}`}>Очередь пуста.</div>
      )}

      <div className="space-y-3">
        {queue.map((q) => {
          const ready = isReady(q);
          const vol = pickVolume(q);
          const chapterLabel = `Том ${vol ?? 0} · Глава ${q.chapter_number}`;
          const tUrl = q.manga_slug ? `/title/${q.manga_slug}` : `/title/${q.manga_id}`;
          const selectedHere = selected.has(q.id);
          const state = working[q.id];

          const uploaderName = pickUploaderName(q);
          const uploaderId = pickUploaderId(q);
          const uploaderDisplay = uploaderName ?? (uploaderId ? `id:${shortId(uploaderId)}` : '—');

          return (
            <div key={q.id} className={`rounded-xl p-4 ${card}`}>
              <div className="flex flex-wrap items-center gap-3">
                {/* checkbox */}
                <button
                  type="button"
                  aria-pressed={selectedHere}
                  onClick={() => toggleOne(q.id)}
                  className={`rounded-md p-1 ${selectedHere ? 'text-emerald-600' : ''} hover:bg-black/5 dark:hover:bg-white/10`}
                  title={selectedHere ? 'Снять выделение' : 'Выделить'}
                  disabled={bulkBusy}
                >
                  {selectedHere ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                </button>

                <div className="flex items-center gap-2 min-w-0">
                  <BookOpen className="h-5 w-5 opacity-70" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      <Link className="hover:underline" href={tUrl}>
                        {q.manga_title || `Тайтл #${q.manga_id}`}
                      </Link>
                      <span className="mx-2">•</span>
                      <span>{chapterLabel}</span>
                    </div>
                    <div className={`text-xs ${muted}`}>
                      ID: {q.id} · страниц: {q.pages_count} · статус: {q.status} · загружено: {fmtDate(q.created_at)} · залил: {uploaderDisplay}
                    </div>
                    {q.title?.trim() && (
                      <div className={`text-xs ${muted}`}>
                        Название главы: <span className="italic">{q.title}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="ml-auto flex items-center gap-2">
                  <button
                    className={`${btn} px-3 py-2`}
                    onClick={() => setPreview(q)}
                    title={PUB_BASE ? 'Предпросмотр' : 'NEXT_PUBLIC_R2_PUBLIC_BASE не задан — покажу подсказку'}
                  >
                    <Eye className="h-4 w-4" />
                    Предпросмотр
                  </button>

                  <span className={`inline-flex items-center gap-1 text-xs ${muted}`}>
                    <Clock className="h-4 w-4" />
                    {fmtDate(q.created_at)}
                  </span>

                  <button
                    className={`px-3 py-2 rounded-lg inline-flex items-center gap-2 ${approveBtn}`}
                    disabled={busyId === q.id || !ready || bulkBusy}
                    onClick={() => approve(q.id)}
                    title={ready ? 'Одобрить и опубликовать' : 'Глава ещё не в статусе ready'}
                  >
                    <CheckCircle2 className={`h-4 w-4 ${busyId === q.id ? 'animate-pulse' : ''}`} />
                    Одобрить
                  </button>

                  <button
                    className={`px-3 py-2 rounded-lg inline-flex items-center gap-2 ${rejectBtn}`}
                    disabled={busyId === q.id || bulkBusy}
                    onClick={() => reject(q.id)}
                    title="Отклонить"
                  >
                    <XCircle className={`h-4 w-4 ${busyId === q.id ? 'animate-pulse' : ''}`} />
                    Отклонить
                  </button>
                </div>
              </div>

              {state && state !== 'done' && (
                <div className="mt-3 text-xs">
                  {state === 'approve' && <span className="text-emerald-500">Публикация…</span>}
                  {state === 'reject' && <span className="text-rose-400">Отклонение…</span>}
                  {state === 'error' && <span className="text-amber-500">Ошибка — см. уведомления</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Preview modal */}
      {preview && (
        <PreviewDialog item={preview} onClose={() => setPreview(null)} themeMode={theme} />
      )}
    </section>
  );
}

/* ===================== Preview components ===================== */
function PreviewDialog({ item, onClose, themeMode }: { item: QueueItem; onClose: () => void; themeMode: 'light' | 'dark' | 'system' | undefined; }) {
  const muted = themeMode === 'light' ? 'text-gray-600' : 'text-slate-400';
  const border = themeMode === 'light' ? 'border-black/10' : 'border-white/10';
  const bgPanel = themeMode === 'light' ? 'bg-white/85' : 'bg-[#0f1115]/85';

  const base = PUB_BASE
    ? `${PUB_BASE}/staging/manga/${item.manga_id}/chapters/${item.id}`
    : '';

  const pages = Array.from({ length: Math.max(0, item.pages_count || 0) }, (_, i) => i + 1);
  const vol = pickVolume(item);

  return (
    <div className="fixed inset-0 z-[130]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className={`absolute inset-4 md:inset-10 z-[131] rounded-2xl ${bgPanel} backdrop-blur-xl border ${border} shadow-[0_20px_80px_rgba(0,0,0,.6)] flex flex-col`}> 
        {/* header */}
        <div className={`flex items-center justify-between gap-3 px-4 py-3 border-b ${border}`}>
          <div className="flex items-center gap-2 min-w-0">
            <ImageIcon className="h-5 w-5 opacity-70" />
            <div className="min-w-0">
              <div className="font-semibold truncate">Предпросмотр · Глава {item.chapter_number} · Том {vol ?? 0}</div>
              <div className={`text-xs ${muted}`}>ID: {item.id} · страниц: {item.pages_count} · загружено: {fmtDate(item.created_at)}</div>
              {item.title?.trim() && (
                <div className={`text-xs ${muted}`}>Название главы: <span className="italic">{item.title}</span></div>
              )}
              {!PUB_BASE && <div className="text-xs text-amber-500 mt-1">NEXT_PUBLIC_R2_PUBLIC_BASE не задан — предпросмотр недоступен</div>}
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-black/5 dark:hover:bg-white/10" aria-label="Закрыть"><X className="h-5 w-5" /></button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-auto p-3 md:p-4">
          {PUB_BASE ? (
            <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {pages.map((i) => (
                <li key={i} className={`rounded-lg overflow-hidden border ${border} bg-black/5`}>
                  <SmartR2Image base={base} index={i} bust={String(new Date(item.created_at).getTime())} />
                </li>
              ))}
            </ul>
          ) : (
            <div className={`text-sm ${muted}`}>Укажите публичную базу R2 в переменной <code className="px-1 py-0.5 rounded bg-black/10">NEXT_PUBLIC_R2_PUBLIC_BASE</code>.</div>
          )}
        </div>
      </div>
    </div>
  );
}

const EXT_CANDIDATES = ['webp', 'jpg', 'jpeg', 'png', 'gif'];

function SmartR2Image({ base, index, bust }: { base: string; index: number; bust?: string; }) {
  const [k, setK] = useState(0); // idx in EXT_CANDIDATES
  const [ok, setOk] = useState(false);
  const [triedAll, setTriedAll] = useState(false);
  const ext = EXT_CANDIDATES[k];
  const src = `${base}/p${String(index).padStart(4, '0')}.${ext}${bust ? `?v=${bust}` : ''}`;

  useEffect(() => { setK(0); setOk(false); setTriedAll(false); }, [base, index]);

  return (
    <div className="relative">
      {!ok && !triedAll && (
        <div className="absolute inset-0 grid place-items-center text-xs text-gray-400">Загрузка…</div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`p${String(index).padStart(4, '0')}`}
        loading="lazy"
        className={`w-full h-full object-contain bg-black/5 ${ok ? '' : 'opacity-0'}`}
        onLoad={() => setOk(true)}
        onError={() => {
          if (k < EXT_CANDIDATES.length - 1) setK(k + 1); else setTriedAll(true);
        }}
      />
      {triedAll && (
        <div className="aspect-[3/4] w-full grid place-items-center text-[11px] text-amber-500 bg-black/5">
          Не найдено ({`p${String(index).padStart(4, '0')}.{${EXT_CANDIDATES.join(',')}}`})
        </div>
      )}
    </div>
  );
}
