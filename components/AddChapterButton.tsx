// components/AddChapterButton.tsx
'use client';

import { createPortal } from 'react-dom';
import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, X, GripVertical, ChevronsLeft, ChevronsRight,
  ArrowUpAZ, ArrowDownAZ, ArrowUp01, ArrowDown01,
} from 'lucide-react';

/* ========= scroll-lock helpers (вне компонента) ========= */
function lockScrollNow() {
  try {
    const root = document.documentElement;
    const sbw = window.innerWidth - root.clientWidth; // scrollbar width
    root.classList.add('overflow-hidden', 'modal-open');
    if (sbw > 0) root.style.paddingRight = `${sbw}px`;
  } catch {}
}
function unlockScrollNow() {
  try {
    const root = document.documentElement;
    root.classList.remove('overflow-hidden', 'modal-open');
    root.style.paddingRight = '';
  } catch {}
}

/* ================= DEV helpers ================= */
// Если в .env есть NEXT_PUBLIC_ADMIN_UPLOAD_KEY, прокидываем его как x-api-key
const DEV_KEY = (process.env.NEXT_PUBLIC_ADMIN_UPLOAD_KEY as string | undefined) || '';
function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers as HeadersInit);
  if (DEV_KEY) headers.set('x-api-key', DEV_KEY);
  return fetch(input, { credentials: 'include', cache: 'no-store', ...init, headers });
}

/* ================= misc helpers ================= */
const makeId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? (crypto as any).randomUUID()
    : Math.random().toString(36).slice(2) + Date.now());

type PageItem = { id: string; file: File; url: string; name: string; size: number };
type TeamOption = { id: number; name: string };
type Props = { mangaId: number; onDone?: () => void };

const collator = new Intl.Collator('ru', { numeric: true, sensitivity: 'base' });
const extractNums = (s: string) => s.match(/\d+/g)?.map(n => parseInt(n, 10)) ?? [];
const cmpByNums = (a: string, b: string) => {
  const aa = extractNums(a), bb = extractNums(b);
  const len = Math.max(aa.length, bb.length);
  for (let i = 0; i < len; i++) {
    const x = aa[i] ?? -Infinity, y = bb[i] ?? -Infinity;
    if (x !== y) return x - y;
  }
  return collator.compare(a, b);
};

function extFromType(t: string) {
  if (!t) return '.bin';
  if (/webp/i.test(t)) return '.webp';
  if (/png/i.test(t)) return '.png';
  if (/jpe?g/i.test(t)) return '.jpg';
  if (/gif/i.test(t)) return '.gif';
  return '.bin';
}

/**
 * Загрузка файла напрямую в R2.
 * 1) POST /api/r2/presign  -> { url, headers, key, publicUrl }
 * 2) PUT <url> (браузер)    -> 200
 */
async function uploadFileToR2(file: File, key: string, cacheControl?: string) {
  const presignRes = await apiFetch('/api/r2/presign', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      key,
      contentType: file.type || 'application/octet-stream',
      cacheControl: cacheControl || 'public, max-age=604800',
      expiresIn: 60,
    }),
  });

  const data = await presignRes.json().catch(() => ({}));
  if (!presignRes.ok || !data?.ok) {
    throw new Error(data?.message || 'Не удалось получить presigned URL');
  }

  // PUT идёт в R2 — без x-api-key
  const put = await fetch(data.url as string, {
    method: 'PUT',
    headers: data.headers || { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });

  if (!put.ok) {
    const txt = await put.text().catch(() => '');
    throw new Error(`R2 PUT ${put.status}: ${txt || 'upload failed'}`);
  }

  return { key: data.key as string, url: data.publicUrl as string };
}

/* ================= component ================= */

export default function AddChapterButton({ mangaId, onDone }: Props) {
  const [open, setOpen] = useState(false);

  async function ensureAuthAndOpen() {
    // DEV — мгновенно: сразу лочим скролл и открываем
    if (DEV_KEY) {
      lockScrollNow();
      setOpen(true);
      return;
    }

    // 1) Проверка сессии
    const me = await apiFetch('/api/me');
    if (me.status === 401) {
      if (confirm('Нужно войти. Перейти на /login?')) window.location.href = '/login';
      return;
    }

    // 2) Проверка права
    const resp = await apiFetch('/api/rpc/is_team_leader_of_manga', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manga_id: mangaId }),
    });
    const check = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      alert(check?.error || `Проверка прав не удалась (HTTP ${resp.status})`);
      return;
    }
    if (check?.allowed !== true) {
      alert('Добавлять главы может только лидер назначенной команды.');
      return;
    }

    // важно: лочим скролл прямо перед маунтом модалки
    lockScrollNow();
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={ensureAuthAndOpen}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700"
      >
        <Upload className="h-4 w-4" /> Добавить главу
      </button>

      <AnimatePresence>
        {open && (
          <Dialog onClose={() => setOpen(false)}>
            <Uploader mangaId={mangaId} onClose={() => setOpen(false)} onDone={onDone} />
          </Dialog>
        )}
      </AnimatePresence>
    </>
  );
}

function Dialog({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  // Синхронный lock скролла
  React.useLayoutEffect(() => {
    const root = document.documentElement;
    const sbw = window.innerWidth - root.clientWidth;
    root.classList.add('overflow-hidden');
    if (sbw > 0) root.style.paddingRight = `${sbw}px`;
    return () => {
      unlockScrollNow(); // снимаем блокировку на размонтаже
    };
  }, []);

  return createPortal(
    <>
      {/* Оверлей без анимации — блюр появляется мгновенно */}
      <div
        className="
          fixed inset-0 z-[120]
          bg-black/30 dark:bg-black/60
          backdrop-blur-sm md:backdrop-blur
          will-change-[backdrop-filter]
        "
        style={{ transform: 'translateZ(0)', contain: 'paint' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Анимируем только панель, отдельным слоем поверх */}
      <div className="fixed inset-0 z-[121] min-h-screen flex items-center justify-center p-4">
        <motion.div
          role="dialog"
          aria-modal="true"
          className="
            w-full max-w-5xl rounded-2xl
            bg-white/80 dark:bg-[#0f1115]/80
            backdrop-blur-xl
            border border-black/10 dark:border-white/10
            shadow-[0_20px_80px_rgba(0,0,0,.6)]
            will-change-[transform,opacity]
          "
          initial={{ y: 18, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 12, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
        >
          {children}
        </motion.div>
      </div>
    </>,
    document.body
  );
}

function Uploader({ mangaId, onClose, onDone }: {
  mangaId: number; onClose: () => void; onDone?: () => void;
}) {
  const [volume, setVolume] = useState<number | ''>('');
  const [chapter, setChapter] = useState<number | ''>('');
  const [title, setTitle] = useState('');
  const [pages, setPages] = useState<PageItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepLabel, setStepLabel] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);

  const [availableTeams, setAvailableTeams] = useState<TeamOption[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<number[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [insertBefore, setInsertBefore] = useState(true);
  const dragging = dragIndex !== null;

  const inputRef = useRef<HTMLInputElement | null>(null);

  // Загружаем список команд, назначенных на этот тайтл
  React.useEffect(() => {
    async function fetchTeams() {
      try {
        const res = await apiFetch(`/api/manga/${mangaId}/teams`);
        if (!res.ok) {
          console.warn('Не удалось загрузить команды');
          setAvailableTeams([]);
          return;
        }
        const data = await res.json();

        // Определяем массив команд из разных возможных структур ответа
        let rawTeams: any[] = [];
        if (Array.isArray(data)) {
          rawTeams = data;
        } else if (Array.isArray(data?.teams)) {
          rawTeams = data.teams;
        } else if (Array.isArray(data?.items)) {
          rawTeams = data.items;
        }

        const teams = rawTeams.map((t: any) => ({
          id: Number(t.id ?? t.team_id ?? 0),
          name: String(t.name ?? t.team_name ?? 'Без названия'),
        }));

        setAvailableTeams(teams);
      } catch (err) {
        console.error('Ошибка загрузки команд:', err);
        setAvailableTeams([]);
      } finally {
        setLoadingTeams(false);
      }
    }
    fetchTeams();
  }, [mangaId]);

  function toggleTeam(teamId: number) {
    setSelectedTeams(prev =>
      prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId]
    );
  }

  function addFiles(fs: FileList | File[]) {
    const list = Array.from(fs || []).filter(f => f.type.startsWith('image/'));
    if (!list.length) return;
    const items: PageItem[] = list.map(file => ({
      id: makeId(),
      file,
      url: URL.createObjectURL(file),
      name: file.name,
      size: file.size,
    }));
    setPages(prev => [...prev, ...items]);
  }
  function onSelectInput(e: React.ChangeEvent<HTMLInputElement>) {
    const fs = e.target.files;
    if (!fs?.length) return;
    addFiles(fs);
    e.currentTarget.value = '';
  }
  function onDropFiles(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  }
  const prevent = (e: React.DragEvent) => e.preventDefault();

  const [nameAsc, setNameAsc] = useState(true);
  const [numAsc, setNumAsc] = useState(true);
  function sortByName() {
    setPages(prev =>
      [...prev].sort((a, b) => (nameAsc ? 1 : -1) * collator.compare(a.name, b.name))
    );
    setNameAsc(v => !v);
  }
  function sortByNumbers() {
    setPages(prev =>
      [...prev].sort((a, b) => (numAsc ? 1 : -1) * cmpByNums(a.name, b.name))
    );
    setNumAsc(v => !v);
  }

  function moveToStart(i: number) {
    setPages(prev => {
      const next = [...prev];
      const [it] = next.splice(i, 1);
      next.unshift(it);
      return next;
    });
  }
  function moveToEnd(i: number) {
    setPages(prev => {
      const next = [...prev];
      const [it] = next.splice(i, 1);
      next.push(it);
      return next;
    });
  }

  function removeAt(i: number) {
    setPages(prev => {
      const next = [...prev];
      const [it] = next.splice(i, 1);
      URL.revokeObjectURL(it.url);
      return next;
    });
  }

  async function submit() {
    setError(null);
    if (chapter === '' || chapter === null) {
      setError('Укажите номер главы');
      return;
    }
    if (!pages.length) {
      setError('Добавьте страницы');
      return;
    }
    if (selectedTeams.length === 0 && availableTeams.length > 0) {
      setError('Выберите хотя бы одну команду');
      return;
    }

    setBusy(true);
    setProgress(0);
    setStepLabel('Создаём черновик…');

    try {
      // 1) Создаём черновик главы и получаем chapterId + baseKey для R2
      const startRes = await apiFetch('/api/chapters/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mangaId,
          chapterNumber: Number(chapter),
          volume: volume === '' ? 0 : Number(volume),
          title: title.trim() || null,
          teamIds: selectedTeams.length > 0 ? selectedTeams : undefined,
        }),
      });

      const start = await startRes.json().catch(() => null);
      if (!startRes.ok || !start?.ok) {
        throw new Error(
          start?.message || `Не удалось создать черновик (HTTP ${startRes.status})`
        );
      }

      // Берём id из нескольких возможных ключей
      const chapterId = Number(
        start?.chapterId ?? start?.id ?? start?.chapter_id ?? 0
      );
      const baseKey: string = String(
        start?.baseKey ??
          start?.base_key ??
          (chapterId
            ? `staging/manga/${mangaId}/chapters/${chapterId}`
            : '')
      );

      // Без id — стоп, никакого commit
      if (!chapterId) {
        console.error('start payload:', start);
        throw new Error('Сервер не вернул id новой главы');
      }

      // 2) Загрузка страниц последовательно
      setStepLabel('Загружаем страницы…');
      const total = pages.length;
      const uploaded: {
        index: number;
        key: string;
        url: string;
        name: string;
      }[] = [];

      for (let i = 0; i < total; i++) {
        const p = pages[i];
        const ext = extFromType(p.file.type);
        const index = i + 1;
        const filename = `p${String(index).padStart(4, '0')}${ext}`;
        const key = `${baseKey.replace(/\/+$/, '')}/${filename}`;

        const { key: savedKey, url } = await uploadFileToR2(
          p.file,
          key,
          'public, max-age=31536000, immutable'
        );

        uploaded.push({ index, key: savedKey, url, name: p.name });
        setProgress(Math.round(((i + 1) / total) * 100));
      }

      // 3) Финализируем главу: передаём серверу список страниц
      setStepLabel('Финализация…');

      // Быстрая страховка перед коммитом
      if (!Number.isFinite(chapterId) || chapterId <= 0) {
        setError('Внутренняя ошибка: пустой chapterId, commit отменён');
        setBusy(false);
        setStepLabel(null);
        return;
      }

      const commitRes = await apiFetch('/api/chapters/commit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chapterId,
          pages: uploaded, // [{index,key,url,name}]
          teamIds: selectedTeams.length > 0 ? selectedTeams : undefined, // передаем команды
        }),
      });

      const payload = await commitRes.json().catch(() => ({}));
      if (!commitRes.ok || !payload?.ok) {
        throw new Error(
          payload?.message ||
            `Не удалось завершить главу (HTTP ${commitRes.status})`
        );
      }

      // Обновляем team_ids отдельным запросом (НЕ трогаем /commit)
      if (selectedTeams.length > 0) {
        try {
          await apiFetch('/api/chapters/update-teams', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              chapterId,
              teamIds: selectedTeams,
            }),
          }).catch(err =>
            console.warn('Не удалось обновить team_ids:', err)
          );
        } catch (err) {
          console.warn('Ошибка обновления team_ids:', err);
        }
      }

      // ✅ Без редиректа. Просто закрываем модалку и вызываем onDone (можно потом дернуть refresh родителя).
      onClose();
      onDone?.();
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
      setStepLabel(null);
    }
  }

  return (
    <>
      {/* Шапка — скругление сверху и корректные цвета в тёмной теме */}
      <div
        className="
          flex items-center justify-between gap-3
          border-b border-black/10 dark:border-white/10
          px-5 py-4
          bg-white/40 dark:bg-white/[0.02] backdrop-blur
          rounded-t-2xl
          text-black dark:text-white
        "
      >
        <h3 className="text-base md:text-lg font-semibold">Новая глава</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 text-black/70 dark:text-white/80 hover:bg-black/5 dark:hover:bg-white/10 hover:text-black dark:hover:text-white transition-colors"
          aria-label="Закрыть"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-[360px_1fr] text-black dark:text-white">
        {/* левая колонка */}
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-gray-700 dark:text-gray-300">
              Том
            </label>
            <input
              type="number"
              inputMode="numeric"
              className="
                w-full rounded-lg
                border border-black/10 dark:border-white/10
                bg-white/60 dark:bg-white/[0.03]
                px-3 py-2
                outline-none focus:border-black/30 dark:focus:border-white/30
                text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-500
                [appearance:textfield]
                [&::-webkit-outer-spin-button]:appearance-none
                [&::-webkit-inner-spin-button]:appearance-none
              "
              placeholder="0"
              value={volume}
              onChange={(e) =>
                setVolume(e.target.value === '' ? '' : Number(e.target.value))
              }
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Можно оставить пустым - будет 0
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-700 dark:text-gray-300">
              Номер главы *
            </label>
            <input
              type="number"
              inputMode="numeric"
              className="
                w-full rounded-lg
                border border-black/10 dark:border-white/10
                bg-white/60 dark:bg-white/[0.03]
                px-3 py-2
                outline-none focus:border-black/30 dark:focus:border-white/30
                text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-500
                [appearance:textfield]
                [&::-webkit-outer-spin-button]:appearance-none
                [&::-webkit-inner-spin-button]:appearance-none
              "
              placeholder="например, 12"
              value={chapter}
              onChange={(e) =>
                setChapter(e.target.value === '' ? '' : Number(e.target.value))
              }
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-700 dark:text-gray-300">
              Название (необязательно)
            </label>
            <input
              type="text"
              className="
                w-full rounded-lg
                border border-black/10 dark:border-white/10
                bg-white/60 dark:bg-white/[0.03]
                px-3 py-2
                outline-none focus:border-black/30 dark:focus:border-white/30
                text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-500
              "
              placeholder="Название"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Выбор команд */}
          <div>
            <label className="mb-1 block text-sm text-gray-700 dark:text-gray-300">
              Команды {availableTeams.length > 0 && (
                <span className="text-red-500">*</span>
              )}
            </label>
            {loadingTeams ? (
              <div className="rounded-lg border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/[0.03] px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                Загрузка команд...
              </div>
            ) : availableTeams.length === 0 ? (
              <div className="rounded-lg border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/[0.03] px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                На этот тайтл не назначены команды
              </div>
            ) : (
              <div className="space-y-2 rounded-lg border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/[0.03] p-3">
                {availableTeams.map((team) => (
                  <label
                    key={team.id}
                    className="flex items-center gap-2 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTeams.includes(team.id)}
                      onChange={() => toggleTeam(team.id)}
                      className="
                        h-4 w-4 rounded border-black/20 dark:border-white/20
                        bg-white/60 dark:bg-white/[0.06]
                        text-emerald-600 focus:ring-2 focus:ring-emerald-500/50
                        cursor-pointer
                      "
                    />
                    <span className="text-sm text-black dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {team.name}
                    </span>
                  </label>
                ))}
              </div>
            )}
            {availableTeams.length > 0 && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Можно выбрать несколько команд
              </p>
            )}
          </div>

          {/* Дропзона */}
          <div
            onDrop={onDropFiles}
            onDragOver={prevent}
            className="grid place-items-center rounded-xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/[0.03] p-6 text-center"
          >
            <div className="text-black/80 dark:text-gray-200">
              Перетащите изображения сюда
              <br />
              <span className="text-gray-500">или</span>
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-2 rounded-md border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] px-3 py-1.5 text-sm hover:bg-white/80 dark:hover:bg-white/[0.09] backdrop-blur transition-colors text-black dark:text-white"
            >
              выбрать файлы
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={onSelectInput}
              className="hidden"
            />
            <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
              Порядок можно менять ниже. Конвертацию в WebP можно сделать
              сервером после загрузки.
            </div>
          </div>
        </div>

        {/* правая колонка */}
        <div className="flex min-h-[420px] flex-col">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Страницы
            </span>
            <span className="rounded bg-black/10 dark:bg-white/10 px-2 py-0.5 text-xs text-gray-800 dark:text-gray-200">
              {pages.length}
            </span>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={sortByName}
                className="inline-flex items-center gap-1 rounded-md border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.06] px-2.5 py-1.5 text-xs hover:bg-white/75 dark:hover:bg-white/[0.09] backdrop-blur text-black dark:text-white"
                title="Сортировать по имени (А↔Я)"
              >
                {nameAsc ? (
                  <ArrowUpAZ className="h-4 w-4" />
                ) : (
                  <ArrowDownAZ className="h-4 w-4" />
                )}{' '}
                Имя
              </button>
              <button
                type="button"
                onClick={sortByNumbers}
                className="inline-flex items-center gap-1 rounded-md border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.06] px-2.5 py-1.5 text-xs hover:bg-white/75 dark:hover:bg-white/[0.09] backdrop-blur text-black dark:text-white"
                title="Сортировать по числам (1↔9)"
              >
                {numAsc ? (
                  <ArrowUp01 className="h-4 w-4" />
                ) : (
                  <ArrowDown01 className="h-4 w-4" />
                )}{' '}
                Числа
              </button>
            </div>
          </div>

          <DropEdge
            visible={dragging}
            label="Отпустить здесь — в начало"
            onDrop={() => {
              /* no-op */
            }}
          />

          <div className="relative max-h-[58vh] flex-1 overflow-auto rounded-xl border border-black/10 dark:border-white/10 bg-white/40 dark:bg-white/[0.02] p-3 backdrop-blur">
            {pages.length === 0 ? (
              <div className="grid h-full place-items-center text-sm text-gray-700 dark:text-gray-300">
                Страницы не выбраны
              </div>
            ) : (
              <ul
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
                onDragOver={(e) => e.preventDefault()}
              >
                {pages.map((p, i) => {
                  const isOverCard = overIndex === i && dragging;
                  const isDragging = dragIndex === i && dragging;
                  return (
                    <motion.li
                      key={p.id}
                      layout
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                      className={[
                        'group relative select-none overflow-hidden rounded-xl border shadow-sm',
                        'border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.04]',
                        isDragging
                          ? 'scale-[0.98] opacity-60'
                          : 'hover:border-black/20 dark:hover:border-white/20',
                        isOverCard ? 'border-sky-400' : '',
                      ].join(' ')}
                      draggable
                      onDragStartCapture={(e) => {
                        e.dataTransfer.effectAllowed = 'move';
                        try {
                          e.dataTransfer.setData('text/plain', String(i));
                        } catch {}
                        setDragIndex(i);
                      }}
                      onDragOver={(e) => {
                        if (!dragging) return;
                        e.preventDefault();
                        const r = (
                          e.currentTarget as HTMLLIElement
                        ).getBoundingClientRect();
                        setOverIndex(i);
                        setInsertBefore(e.clientX - r.left < r.width / 2);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragIndex === null) return;
                        setPages((prev) => {
                          let from = dragIndex!;
                          let to = insertBefore ? i : i + 1;
                          if (from < to) to -= 1;
                          const next = [...prev];
                          const [it] = next.splice(from, 1);
                          next.splice(to, 0, it);
                          return next;
                        });
                        setDragIndex(null);
                        setOverIndex(null);
                      }}
                      onDragEndCapture={() => {
                        setDragIndex(null);
                        setOverIndex(null);
                      }}
                      title={p.name}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.url}
                        alt={p.name}
                        className="aspect-[3/4] h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        draggable={false}
                      />
                      <div className="pointer-events-none absolute inset-0">
                        {isOverCard && (
                          <div
                            className={`absolute top-0 ${
                              insertBefore ? 'left-0' : 'right-0'
                            } h-full w-[3px] bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,.8)]`}
                          />
                        )}
                      </div>
                      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-1 bg-gradient-to-b from-black/40 to-transparent px-2 py-1">
                        <span className="inline-flex items-center gap-1 rounded bg-black/50 px-1.5 py-0.5 text-[11px] text-white">
                          <GripVertical className="h-3.5 w-3.5" /> {i + 1}
                        </span>
                        <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => moveToStart(i)}
                            className="rounded bg-black/50 p-1 text-white hover:bg-black/60"
                            title="В начало"
                          >
                            <ChevronsLeft className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveToEnd(i)}
                            className="rounded bg-black/50 p-1 text-white hover:bg-black/60"
                            title="В конец"
                          >
                            <ChevronsRight className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeAt(i)}
                            className="rounded bg-black/50 p-1 text-white hover:bg-red-600/80"
                            title="Удалить"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1">
                        <div className="truncate text-xs text-white drop-shadow">
                          {p.name}
                        </div>
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </div>

          <DropEdge
            visible={dragging}
            label="Отпустить здесь — в конец"
            onDrop={() => {
              /* no-op */
            }}
          />

          {/* прогресс/статус */}
          {(busy && (stepLabel || progress > 0)) && (
            <div className="mt-3 rounded-lg border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/[0.03] px-3 py-2 text-sm backdrop-blur">
              <div className="mb-1 text-gray-800 dark:text-gray-200">
                {stepLabel || 'Обработка…'}
              </div>
              <div className="h-2 w-full rounded bg-black/10 dark:bg-white/10">
                <div
                  className="h-2 rounded bg-emerald-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="mt-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          {/* Кнопки */}
          <div className="mt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm border border-black/15 dark:border-white/15 bg-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 dark:focus-visible:ring-white/20 disabled:opacity-60"
              disabled={busy}
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={submit}
              className="group relative rounded-xl px-5 py-2 text-sm font-semibold border border-black/20 dark:border-white/20 bg-white/80 dark:bg-white/[0.06] hover:bg-white/90 dark:hover:bg-white/[0.09] backdrop-blur transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 shadow-[0_1px_0_rgba(0,0,0,0.06),0_8px_20px_-10px_rgba(0,0,0,0.45)] hover:shadow-[0_1px_0_rgba(0,0,0,0.06),0_12px_28px_-10px_rgba(0,0,0,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 dark:focus-visible:ring-white/20 disabled:opacity-60"
              disabled={busy}
            >
              {busy ? 'Загрузка…' : 'Загрузить'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function DropEdge({
  visible,
  label,
  onDrop,
}: {
  visible: boolean;
  label: string;
  onDrop: () => void;
}) {
  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          className="mb-3 grid place-items-center rounded-lg border border-dashed border-sky-500/50 bg-sky-500/10 px-3 py-2 text-xs text-sky-200"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onDrop();
          }}
        >
          {label}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
