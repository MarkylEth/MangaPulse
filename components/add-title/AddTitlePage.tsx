'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { useTheme } from '@/lib/theme/context';
import { GENRES as DEFAULT_GENRES, TAGS as DEFAULT_TAGS } from '@/lib/taxonomy';
import {
  ArrowLeft, Upload, X, User, AlertTriangle, CheckCircle,
  Loader2, Search, Plus, Check
} from 'lucide-react';

/* ================= Types ================= */
type TeamLite = { id: number; name: string; slug: string | null };

type Entity = { id: number; name: string; slug?: string | null };
type TitleStatus = 'ongoing' | 'completed' | 'paused';
type TranslationStatus = 'продолжается' | 'завершён' | 'заброшен' | 'заморожен';
type AgeRating = '0+' | '12+' | '16+' | '18+';
type TitleKind = 'манга' | 'манхва' | 'маньхуа' | 'другое';

/* ----- Формат выпуска ----- */
type ReleaseFormatKey =
  | 'yonkoma'     // 4-кома
  | 'collection'  // сборник
  | 'color'       // в цвете
  | 'web'         // веб
  | 'doujinshi'   // додзинси
  | 'single'      // сингл (ваншот)
  | 'webtoon';    // вебтун

const RELEASE_FORMATS: { key: ReleaseFormatKey; label: string }[] = [
  { key: 'yonkoma',   label: '4-кома (Ёнкома)' },
  { key: 'collection',label: 'Сборник' },
  { key: 'color',     label: 'В цвете' },
  { key: 'web',       label: 'Веб' },
  { key: 'doujinshi', label: 'Додзинси' },
  { key: 'single',    label: 'Сингл' },
  { key: 'webtoon',   label: 'Вебтун' },
];

/* ====== утилиты/стили ====== */
const cn = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(' ');
const clampYear = (n: number) =>
  Math.min(Math.max(n || new Date().getFullYear(), 1900), new Date().getFullYear() + 1);

function useDebounced<T>(value: T, delay: number) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
async function safeJson<T = any>(res: Response): Promise<T | null> {
  const ct = res.headers.get('content-type') || '';
  const text = await res.text();
  if (!text) return null;
  if (ct.includes('application/json')) {
    try { return JSON.parse(text) as T; } catch { return null; }
  }
  try { return JSON.parse(text) as T; } catch { return null; }
}

/* ====== лимиты ====== */
const LIMITS = {
  titleRu: 199,
  titleRomaji: 200,
  person: 100,
  description: 4000,
  modMessage: 1000,
  teamSearch: 60,
  url: 2048,
};

const TEAM_SEARCH_MIN = 3;
const TEAM_DEBOUNCE_MS = 350;

/* ================= EntitySearch (Автор/Художник/Издатель) ================= */
function EntitySearch({
  label,
  kind,
  endpointSearch,
  endpointCreate,
  selected,
  onChange,
  theme,
}: {
  label: string;
  kind: 'author' | 'artist' | 'publisher';
  endpointSearch: string;
  endpointCreate: string;
  selected: Entity[];
  onChange: (next: Entity[]) => void;
  theme: 'light' | 'dark';
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const s = q.trim();
    if (!s) { 
      setItems([]); 
      setLoading(false); 
      setError(null);
      abortRef.current?.abort(); 
      return; 
    }
    
    setLoading(true);
    setError(null);
    const ctrl = new AbortController(); 
    abortRef.current = ctrl;
    
    const t = setTimeout(async () => {
      try {
        const url = endpointSearch.includes('?')
          ? `${endpointSearch}&q=${encodeURIComponent(s)}`
          : `${endpointSearch}?q=${encodeURIComponent(s)}`;
        
        const res = await fetch(url, { signal: ctrl.signal });

        if (!res.ok) {
          if (res.status === 404) { setItems([]); setError(null); return; }
          throw new Error(`Ошибка поиска: ${res.status}`);
        }

        const js = await res.json();
        const arr: Entity[] = Array.isArray(js?.items)
          ? js.items
          : (Array.isArray(js) ? js : []);
        setItems(arr);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Search error:', err);
          setError(err.message || 'Ошибка поиска');
        }
      } finally {
        setLoading(false);
      }
    }, 250);
    
    return () => { 
      clearTimeout(t); 
      ctrl.abort(); 
    };
  }, [q, endpointSearch]);

  const toggle = (e: Entity) => {
    const has = selected.some(x => x.id === e.id);
    onChange(has ? selected.filter(x => x.id !== e.id) : [...selected, e]);
    setQ('');
    setOpen(false);
    setError(null);
  };

  const createEntity = async () => {
    const name = q.trim();
    if (!name) { setError('Имя не может быть пустым'); return; }
    setCreating(true);
    setError(null);
    try {
      const body = kind === 'publisher' ? { name } : { name, role: kind.toUpperCase() };
      const res = await fetch(endpointCreate, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Ошибка создания: ${res.status}`);
      const js = await res.json();
      let created: Entity | null = null;
      if (js?.item?.id && js?.item?.name) created = { id: Number(js.item.id), name: js.item.name, slug: js.item.slug ?? null };
      else if (js?.data?.item?.id && js?.data?.item?.name) created = { id: Number(js.data.item.id), name: js.data.item.name, slug: js.data.item.slug ?? null };
      else if (js?.id && js?.name) created = { id: Number(js.id), name: js.name, slug: js.slug ?? null };
      if (!created) throw new Error('Не удалось извлечь данные созданной сущности');
      toggle(created);
    } catch (err: any) {
      console.error('Create entity error:', err);
      setError(err.message || 'Не удалось создать');
    } finally {
      setCreating(false);
    }
  };

  const inputBase =
    'w-full rounded-xl px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none transition-colors ' +
    '[appearance:auto] dark:[color-scheme:dark] light:[color-scheme:light]';
  const inputCls =
    theme === 'light'
      ? cn(inputBase, 'border border-black/10 bg-white/70 focus:border-black/25')
      : cn(inputBase, 'border border-white/10 bg-white/[0.04] text-white focus:border-white/25');

  return (
    <div className="space-y-3">
      <div className={`mb-1 text-sm ${theme === 'light' ? 'text-gray-700' : 'text-gray-100'}`}>
        {label}
      </div>

      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-70" />
          <input
            className={cn(inputCls, 'pl-9')}
            placeholder={`Найти ${label.toLowerCase()}…`}
            value={q}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQ(e.target.value);
              setError(null);
            }}
          />
        </div>

        {error && (
          <div className="mt-2 text-sm text-red-500 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        {loading && (
          <div className="mt-2 text-sm opacity-70 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Поиск…
          </div>
        )}

        {open && q.trim() && !loading && (
          <div
            className={cn(
              'absolute left-0 right-0 mt-1 w-full overflow-auto rounded-2xl border z-[70] shadow-xl',
              'max-h-[220px] nice-scrollbar',
              theme === 'light'
                ? 'bg-white/95 border-black/10 backdrop-blur'
                : 'bg-[#0b0b0f]/95 border-white/10 backdrop-blur text-white'
            )}
          >
            {items.slice(0, 8).map((it) => {
              const sel = selected.some(s => s.id === it.id);
              return (
                <button
                  key={`${kind}-${it.id}`}
                  type="button"
                  onClick={() => toggle({ 
                    id: Number(it.id), 
                    name: it.name, 
                    slug: it.slug ?? null 
                  })}
                  className={cn(
                    'w-full h-10 px-3 text-left text-sm flex items-center justify-between',
                    theme === 'light' ? 'hover:bg-black/5' : 'hover:bg-white/10',
                    sel && (theme === 'light' 
                      ? 'bg-emerald-50 text-emerald-700' 
                      : 'bg-emerald-900/20 text-emerald-300')
                  )}
                >
                  <span className="truncate">{it.name}</span>
                  {sel && <Check className="w-4 h-4" />}
                </button>
              );
            })}

            {items.length === 0 && (
              <div className="px-3 py-2 text-sm opacity-70">
                Ничего не найдено
              </div>
            )}

            <div className={cn('p-2 border-t', theme === 'light' ? 'border-black/10' : 'border-white/10')}>
              <button
                type="button"
                onClick={createEntity}
                disabled={creating || !q.trim()}
                className={cn(
                  'w-full inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm',
                  theme === 'light'
                    ? 'border border-black/10 bg-white/80 hover:bg-white/90'
                    : 'border border-white/15 bg-white/[0.06] hover:bg-white/[0.1]',
                  'disabled:opacity-60 disabled:cursor-not-allowed'
                )}
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Создать «{q.trim()}»
              </button>
            </div>
          </div>
        )}
      </div>

      {!!selected.length && (
        <div className="flex flex-wrap gap-2">
          {selected.map((e) => (
            <span
              key={`${kind}-sel-${e.id}`}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm',
                theme === 'light'
                  ? 'bg-white/80 border-black/10 text-gray-900 backdrop-blur'
                  : 'bg-white/[0.06] border-white/10 text-white backdrop-blur'
              )}
            >
              <User className="h-4 w-4 opacity-70" />
              <span className="max-w-[220px] truncate">{e.name}</span>
              <button
                className="opacity-70 hover:opacity-100"
                onClick={() => onChange(selected.filter(x => x.id !== e.id))}
                aria-label="Удалить"
              >
                <X className="h-4 w-4" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
/* ================= COVER ================= */
function CoverCard({
  theme, coverUrl, file, setFile,
}: {
  theme: 'light' | 'dark';
  coverUrl: string;
  file: File | null;
  setFile: (f: File | null) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const muted = theme === 'light' ? 'text-gray-500' : 'text-gray-400';

  return (
    <div
      className={cn(
        'rounded-2xl border p-4',
        theme === 'light' ? 'bg-white/80 border-black/10 backdrop-blur-xl' : 'bg-white/[0.03] border-white/10 backdrop-blur-xl'
      )}
    >
      <div className="relative h-[360px] w-full overflow-hidden rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
        {preview ? (
          <Image src={preview} alt="preview" fill className="object-cover" unoptimized />
        ) : coverUrl ? (
          <Image src={coverUrl} alt="cover" fill className="object-cover" />
        ) : (
          <div className={cn('grid h-full w-full place-items-center text-sm', muted)}>Нет обложки</div>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <label className={cn(
          'inline-flex cursor-pointer items-center justify-center gap-2',
          'rounded-xl px-4 py-2 text-sm border',
          theme === 'light'
            ? 'border-black/15 bg-transparent hover:bg-black/[0.04]'
            : 'border-white/15 bg-transparent hover:bg-white/[0.06]'
        )}>
          <Upload className="h-4 w-4" />
          <span>Загрузить файл</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>
      </div>
    </div>
  );
}

/* ================= Главный компонент ================= */
export default function AddTitlePage() {
  const { theme } = useTheme();
  const router = useRouter();

  const pageBg =
    theme === 'light'
      ? 'bg-gray-50 text-gray-900'
      : 'bg-[radial-gradient(1200px_600px_at_20%_-10%,rgba(255,255,255,0.06),transparent_50%),radial-gradient(900px_500px_at_120%_-10%,rgba(59,130,246,0.08),transparent_40%)] bg-[#0f0f0f] text-gray-100';

  const glassCard =
    theme === 'light'
      ? 'bg-white/80 border-black/10 backdrop-blur-xl'
      : 'bg-white/[0.03] border-white/10 backdrop-blur-xl';
  const label = theme === 'light' ? 'text-gray-700' : 'text-gray-100';

  const inputBase =
    'w-full rounded-xl px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none transition-colors ' +
    '[appearance:auto] dark:[color-scheme:dark] light:[color-scheme:light]';
  const inputCls =
    theme === 'light'
      ? cn(inputBase, 'border border-black/10 bg-white/70 focus:border-black/25')
      : cn(inputBase, 'border border-white/10 bg-white/[0.04] text-white focus:border-white/25');
  const selectCls = inputCls + ' [appearance:auto]';

  const primaryBtn =
    'group relative rounded-xl px-5 py-2 text-sm font-semibold border border-black/20 dark:border-white/20 bg-white/80 dark:bg-white/[0.06] hover:bg-white/90 dark:hover:bg-white/[0.09] backdrop-blur transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 shadow-[0_1px_0_rgba(0,0,0,0.06),0_8px_20px_-10px_rgba(0,0,0,0.45)] hover:shadow-[0_1px_0_rgba(0,0,0,0.06),0_12px_28px_-10px_rgba(0,0,0,0.55)]';
  const secondaryBtn =
    'rounded-xl px-4 py-2 text-sm border border-black/15 dark:border-white/15 bg-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors';

  // форма
  const [titleRu, setTitleRu] = useState('');
  const [titleRomaji, setTitleRomaji] = useState(''); // кладём в title_romaji
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TitleStatus>('ongoing');
  const [translationStatus, setTranslationStatus] = useState<TranslationStatus>('продолжается');
  const [age, setAge] = useState<AgeRating>('16+');
  const [releaseYear, setReleaseYear] = useState<number>(new Date().getFullYear());
  const [titleType, setTitleType] = useState<TitleKind>('манга');

  const [genres, setGenres] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  const [origLinks, setOrigLinks] = useState<string[]>([]);
  const [modMessage, setModMessage] = useState('');

  // обложка
  const [coverUrl, setCoverUrl] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);

  // переводчики
  const [translators, setTranslators] = useState<{ id: number | string; name: string; slug: string | null }[]>([]);
  const [translatorQuery, setTranslatorQuery] = useState('');
  const [translatorResults, setTranslatorResults] = useState<any[]>([]);
  const debouncedTeamQ = useDebounced(translatorQuery.trim().toLowerCase(), TEAM_DEBOUNCE_MS);
  const teamCacheRef = React.useRef<Record<string, any[]>>({});

  // сущности
  const [authors, setAuthors] = useState<Entity[]>([]);
  const [artists, setArtists] = useState<Entity[]>([]);
  const [publishers, setPublishers] = useState<Entity[]>([]);

  // формат выпуска
  const [releaseFormats, setReleaseFormats] = useState<ReleaseFormatKey[]>([]);

  // статус
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /* ===== live-поиск команд переводчиков ===== */
  useEffect(() => {
    let active = true;
    const q = debouncedTeamQ;

    if (q.length < TEAM_SEARCH_MIN) {
      setTranslatorResults([]);
      return;
    }

    if (teamCacheRef.current[q]) {
      setTranslatorResults(teamCacheRef.current[q]);
      return;
    }

    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(`/api/teams/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        const j = await safeJson<any>(res);
        if (!active) return;
        const items = Array.isArray(j?.items) ? j.items : (Array.isArray(j?.data) ? j.data : []);
        teamCacheRef.current[q] = items;
        setTranslatorResults(items);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        if (active) setTranslatorResults([]);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [debouncedTeamQ]);

  function addTranslator(t: any) {
    if (!t) return;
    setTranslators((prev) =>
      prev.some((x) => String(x.id) === String(t.id))
        ? prev
        : [...prev, { id: t.id, name: t.name, slug: t.slug ?? null }]
    );
    setTranslatorQuery('');
    setTranslatorResults([]);
  }
  const removeTranslator = (id: number | string) =>
    setTranslators((prev) => prev.filter((x) => String(x.id) !== String(id)));

  async function uploadCoverIfNeeded(): Promise<string> {
    if (!coverFile) return coverUrl.trim();
    const fd = new FormData();
    fd.append('file', coverFile);
    fd.append('type', 'cover');
    const r = await fetch('/api/upload', { method: 'POST', body: fd });
    const j = await safeJson<{ ok?: boolean; url?: string; error?: string }>(r);
    if (!r.ok || !j?.ok || !j?.url) throw new Error(j?.error || 'Ошибка загрузки обложки');
    return j.url as string;
  }

  /* ===== отправка заявки на создание ===== */
  async function submitCreate() {
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      if (!titleRu.trim()) throw new Error('Укажите название тайтла');
      const finalCover = await uploadCoverIfNeeded();

      const body = {
        type: titleType,
        source_links: origLinks.slice(0, 2),
        genres,
        tags,
        author_comment: modMessage || null,
        payload: {
          title: titleRu,
          title_ru: titleRu,
          original_title: titleRomaji || null,
          title_romaji: titleRomaji || '',

          cover_url: finalCover || null,
          description: description || null,
          status,
          translation_status: translationStatus,
          age_rating: age,
          release_year: clampYear(Number(releaseYear)),
          type: titleType,
          genres,
          tags,

          // формат выпуска
          release_formats: releaseFormats.map(k => RELEASE_FORMATS.find(x => x.key === k)!.label),
          release_format_keys: releaseFormats,

          // связи
          author_ids: authors.map(a => a.id),
          artist_ids: artists.map(a => a.id),
          publisher_ids: publishers.map(p => p.id),

          // для удобства модерации
          authors: authors.map(a => ({ id: a.id, name: a.name, slug: a.slug ?? null })),
          artists: artists.map(a => ({ id: a.id, name: a.name, slug: a.slug ?? null })),
          publishers: publishers.map(p => ({ id: p.id, name: p.name, slug: p.slug ?? null })),

          // переводчики
          translator_team_id: translators[0]?.id ?? null,
          translators: translators.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
        },
      };

      const res = await fetch('/api/title-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const json = await safeJson<any>(res);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `Ошибка отправки: HTTP ${res.status}`);
      }

      setNotice('Заявка отправлена на модерацию');

      // очистка формы
      setTitleRu('');
      setTitleRomaji('');
      setDescription('');
      setStatus('ongoing');
      setTranslationStatus('продолжается');
      setAge('16+');
      setReleaseYear(new Date().getFullYear());
      setTitleType('манга');
      setGenres([]); setTags([]);
      setOrigLinks([]); setModMessage('');
      setTranslators([]); setTranslatorQuery(''); setTranslatorResults([]);
      setAuthors([]); setArtists([]); setPublishers([]);
      setCoverFile(null); setCoverUrl('');
      setReleaseFormats([]); // сброс форматов
    } catch (e: any) {
      setError(e?.message || 'Не удалось отправить заявку');
    } finally {
      setSaving(false);
    }
  }

  /* ============ РЕНДЕР ============ */
  return (
    <div className={`min-h-screen ${pageBg}`}>
      <Header showSearch={false} />
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Навигация */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button onClick={() => router.back()} className={secondaryBtn}>
            <span className="inline-flex items-center gap-2"><ArrowLeft className="h-4 w-4" /> Назад</span>
          </button>
          <div className="text-2xl font-bold">Добавить тайтл</div>
        </div>

        {/* Alerts */}
        {error && (
          <div
            className={cn(
              'mb-4 rounded-2xl border p-3',
              theme === 'light'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-red-500/10 border-red-500/30 text-red-100'
            )}
          >
            <AlertTriangle className="mr-2 inline-block h-4 w-4" />
            {error}
          </div>
        )}
        {notice && (
          <div
            className={cn(
              'mb-4 rounded-2xl border p-3',
              theme === 'light'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-green-500/10 border-green-500/30 text-green-100'
            )}
          >
            <CheckCircle className="mr-2 inline-block h-4 w-4" />
            {notice}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          {/* LEFT: Cover */}
          <aside className="md:col-span-4 md:sticky md:top-6 self-start">
            <CoverCard theme={theme} coverUrl={coverUrl} file={coverFile} setFile={setCoverFile} />
          </aside>

          {/* RIGHT: Form sections */}
          <section className="md:col-span-8 space-y-6">
            {/* Основная информация */}
            <div className={cn('rounded-2xl border', glassCard)}>
              <SectionHeader title="Основная информация" />
              <div className="p-4 md:p-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Название (русское)" labelClass={label}>
                  <input
                    className={inputCls}
                    value={titleRu}
                    maxLength={LIMITS.titleRu}
                    onChange={(e) => setTitleRu(e.target.value)}
                    placeholder="«Стальной алхимик»"
                  />
                </Field>
                <Field label="Оригинальное (ромадзи)" labelClass={label}>
                  <input
                    className={inputCls}
                    value={titleRomaji}
                    maxLength={LIMITS.titleRomaji}
                    onChange={(e) => setTitleRomaji(e.target.value)}
                    placeholder="Fullmetal Alchemist / Hagane no Renkinjutsushi"
                  />
                </Field>
              </div>

              <div className="px-4 md:px-5"><Divider /></div>

              <div className="p-4 md:p-5">
                <div className={cn('mb-1 text-sm', label)}>Описание</div>
                <textarea
                  className={cn(
                    inputCls,
                    'min-h-[140px] max-h-60 resize-none overflow-auto leading-relaxed',
                    'nice-scrollbar'
                  )}
                  value={description}
                  maxLength={LIMITS.description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Краткое описание тайтла…"
                />
              </div>
            </div>

            {/* Статусы и атрибуты */}
            <div className={cn('rounded-2xl border', glassCard)}>
              <SectionHeader title="Статусы и атрибуты" />
              <div className="p-4 md:p-5 grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* статус тайтла */}
                <div>
                  <div className={`mb-1 text-sm ${label}`.replace(' text-', ' ')}>Статус тайтла</div>
                  <select
                    className={`${selectCls} [&>option]:text-black`}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TitleStatus)}
                  >
                    <option value="ongoing" className="text-black">онгоинг</option>
                    <option value="completed" className="text-black">завершен</option>
                    <option value="paused" className="text-black">приостановлен</option>
                  </select>
                </div>

                {/* статус перевода */}
                <div>
                  <div className={`mb-1 text-sm ${label}`.replace(' text-', ' ')}>Статус перевода</div>
                  <select
                    className={`${selectCls} [&>option]:text-black`}
                    value={translationStatus}
                    onChange={(e) => setTranslationStatus(e.target.value as TranslationStatus)}
                  >
                    <option value="продолжается" className="text-black">продолжается</option>
                    <option value="завершён" className="text-black">завершен</option>
                    <option value="заброшен" className="text-black">заброшен</option>
                    <option value="заморожен" className="text-black">заморожен</option>
                  </select>
                </div>

                {/* возраст */}
                <div>
                  <div className={`mb-1 text-sm ${label}`.replace(' text-', ' ')}>Возрастное ограничение</div>
                  <select
                    className={`${selectCls} [&>option]:text-black`}
                    value={age}
                    onChange={(e) => setAge(e.target.value as AgeRating)}
                  >
                    {(['0+','12+','16+','18+'] as AgeRating[]).map(v => (
                      <option key={v} value={v} className="text-black">{v}</option>
                    ))}
                  </select>
                </div>

                {/* год */}
                <Field label="Год релиза" labelClass={label}>
                  <input
                    className={cn(
                      inputCls,
                      '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
                    )}
                    type="number"
                    min={1900}
                    max={new Date().getFullYear() + 1}
                    value={releaseYear}
                    onChange={(e) => setReleaseYear(clampYear(Number(e.target.value)))}
                    placeholder="например, 2012"
                  />
                </Field>

                {/* тип */}
                <div>
                  <div className={`mb-1 text-sm ${label}`.replace(' text-', ' ')}>Тип</div>
                  <select
                    className={`${selectCls} [&>option]:text-black`}
                    value={titleType}
                    onChange={(e) => setTitleType(e.target.value as TitleKind)}
                  >
                    {(['манга','манхва','маньхуа','другое'] as TitleKind[]).map(v => (
                      <option key={v} value={v} className="text-black">{v}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Формат выпуска */}
            <div className={cn('rounded-2xl border', glassCard)}>
              <SectionHeader title="Формат выпуска" />
              <div className="p-4 md:p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {RELEASE_FORMATS.map(f => {
                    const checked = releaseFormats.includes(f.key);
                    return (
                      <label
                        key={f.key}
                        className={cn(
                          'flex items-center gap-2 rounded-xl border px-3 py-2 cursor-pointer select-none',
                          theme === 'light'
                            ? 'border-black/10 bg-white/70 hover:bg-black/[0.04]'
                            : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-white'
                        )}
                      >
                        <input
                          type="checkbox"
                          className="accent-blue-600 h-4 w-4"
                          checked={checked}
                          onChange={() =>
                            setReleaseFormats(prev =>
                              checked ? prev.filter(k => k !== f.key) : [...prev, f.key]
                            )
                          }
                        />
                        <span className="text-sm">{f.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Жанры и теги */}
            <div className={cn('rounded-2xl border', glassCard)}>
              <SectionHeader title="Жанры и теги" />
              <div className="p-4 md:p-5 grid grid-cols-1 gap-6 md:grid-cols-2">
                <PickTokens
                  title="Жанры"
                  theme={theme}
                  values={genres}
                  setValues={setGenres}
                  placeholder="поиск по жанрам…"
                  quick={DEFAULT_GENRES}
                />
                <PickTokens
                  title="Теги"
                  theme={theme}
                  values={tags}
                  setValues={setTags}
                  placeholder="поиск по тегам…"
                  quick={DEFAULT_TAGS}
                />
              </div>
            </div>

            {/* Автор/Художник/Издатель */}
            <div className={cn('rounded-2xl border', glassCard)}>
              <SectionHeader title="Автор / Художник / Издатель" />
              <div className="p-4 md:p-5 space-y-6">
                <EntitySearch
                  label="Автор"
                  kind="author"
                  endpointSearch="/api/people/search?role=AUTHOR"
                  endpointCreate="/api/people"
                  selected={authors}
                  onChange={setAuthors}
                  theme={theme}
                />
                <EntitySearch
                  label="Художник"
                  kind="artist"
                  endpointSearch="/api/people/search?role=ARTIST"
                  endpointCreate="/api/people"
                  selected={artists}
                  onChange={setArtists}
                  theme={theme}
                />
                <EntitySearch
                  label="Издатель"
                  kind="publisher"
                  endpointSearch="/api/publishers/search"
                  endpointCreate="/api/publishers"
                  selected={publishers}
                  onChange={setPublishers}
                  theme={theme}
                />
              </div>
            </div>

            {/* Переводчики */}
            <div className={cn('rounded-2xl border', glassCard, 'relative z-[60]')}>
              <SectionHeader title="Переводчики" />
              <div className="p-4 md:p-5">
                <div className="mb-2 flex flex-wrap gap-2">
                  {translators.length === 0 ? (
                    <span className="text-sm opacity-70">Пока не выбрано</span>
                  ) : null}
                  {translators.map((t) => (
                    <span
                      key={String(t.id)}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm',
                        theme === 'light'
                          ? 'bg-white/80 border-black/10 text-gray-900 backdrop-blur'
                          : 'bg-white/[0.06] border-white/10 text-white backdrop-blur'
                      )}
                    >
                      <User className="h-4 w-4 opacity-70" />
                      <span className="max-w-[220px] truncate">{t.name}</span>
                      <button
                        className="opacity-70 hover:opacity-100"
                        onClick={() => removeTranslator(t.id)}
                        aria-label="Удалить переводчика"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="relative">
                  <input
                    className={inputCls}
                    value={translatorQuery}
                    maxLength={LIMITS.teamSearch}
                    onChange={(e) => setTranslatorQuery(e.target.value)}
                    placeholder="Найдите команду по названию/слагу…"
                  />

                  {translatorQuery.trim().length > 0 &&
                   translatorQuery.trim().length < TEAM_SEARCH_MIN && (
                    <div className="mt-1 text-xs opacity-70">
                      Введите ещё {TEAM_SEARCH_MIN - translatorQuery.trim().length} символ(а) для поиска
                    </div>
                  )}

                  {translatorResults.length > 0 &&
                   translatorQuery.trim().length >= TEAM_SEARCH_MIN && (
                    <div
                      role="listbox"
                      className={cn(
                        'absolute left-0 right-0 mt-1 w-full overflow-auto rounded-2xl border z-[70] shadow-xl',
                        'max-h-[155px] nice-scrollbar',
                        theme === 'light'
                          ? 'bg-white/95 border-black/10 backdrop-blur'
                          : 'bg-[#0b0b0f]/95 border-white/10 backdrop-blur text-white'
                      )}
                    >
                      {translatorResults.map((t) => (
                        <button
                          key={t.id as any}
                          type="button"
                          onClick={() => addTranslator(t)}
                          className={cn(
                            'w-full h-10 px-3 text-left text-sm flex items-center',
                            theme === 'light' ? 'hover:bg-black/5' : 'hover:bg-white/10'
                          )}
                        >
                          <span className="truncate">{t.name}</span>
                          {t.slug ? <span className="ml-2 opacity-70 truncate">({t.slug})</span> : null}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Источники + комментарий */}
            <div className={cn('rounded-2xl border', glassCard)}>
              <SectionHeader title="Источники и комментарий для модерации" />
              <div className="p-4 md:p-5 grid grid-cols-1 gap-6 md:grid-cols-2">
                <LinksInput
                  label="Ссылки на оригинал"
                  theme={theme}
                  values={origLinks}
                  placeholder="https://…"
                  onChange={setOrigLinks}
                />
                <div>
                  <div className={cn('mb-1 text-sm', label)}>Сообщение для модераторов</div>
                  <textarea
                    className={cn(
                      inputCls,
                      'min-h-[120px] max-h-56 resize-none overflow-auto',
                      'nice-scrollbar'
                    )}
                    placeholder="Источник названия/обложки и прочие детали"
                    value={modMessage}
                    maxLength={LIMITS.modMessage}
                    onChange={(e) => setModMessage(e.target.value)}
                  />
                </div>
              </div>

              {/* Кнопки */}
              <div className="px-4 md:px-5 pb-4 md:pb-5">
                <div className="h-px w-full bg-black/10 dark:bg-white/10 mb-4" />
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={submitCreate}
                    disabled={saving}
                    className={cn(primaryBtn, saving && 'opacity-60 cursor-not-allowed')}
                  >
                    {saving ? 'Отправка…' : 'Отправить на модерацию'}
                  </button>
                  <button onClick={() => router.back()} className={secondaryBtn}>
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ====== мелкие UI ====== */
function SectionHeader({ title }: { title: string }) {
  return (
    <div className="px-4 md:px-5 pt-4 md:pt-5">
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      <div className="mt-3 h-px w-full bg-black/10 dark:bg-white/10" />
    </div>
  );
}
function Divider() { return <div className="h-px w-full bg-black/10 dark:bg-white/10" />; }

function Field({
  label,
  children,
  labelClass,
}: {
  label: string;
  children: React.ReactNode;
  labelClass?: string;
}) {
  return (
    <div>
      <div className={cn('mb-1 text-sm', labelClass)}>{label}</div>
      {children}
    </div>
  );
}

function PickTokens({
  title, theme, values, setValues, placeholder, quick,
}: {
  title: string;
  theme: 'light' | 'dark';
  values: string[];
  setValues: (v: string[]) => void;
  placeholder: string;
  quick: readonly string[];
}) {
  const [q, setQ] = React.useState('');

  const inputBase =
    'w-full rounded-xl px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none transition-colors ' +
    '[appearance:auto] dark:[color-scheme:dark] light:[color-scheme:light]';
  const inputCls =
    theme === 'light'
      ? cn(inputBase, 'border border-black/10 bg-white/70 focus:border-black/25')
      : cn(inputBase, 'border border-white/10 bg-white/[0.04] text-white focus:border-white/25');

  const available = React.useMemo(
    () => quick.filter((x) => !values.includes(x)),
    [quick, values]
  );

  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return available;
    return available.filter((x) => x.toLowerCase().includes(s));
  }, [q, available]);

  const add = (token: string) => {
    if (!values.includes(token)) setValues([...values, token]);
    setQ('');
  };
  const remove = (token: string) => setValues(values.filter((x) => x !== token));

  const onEnter: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); if (filtered.length > 0) add(filtered[0]); }
  };

  return (
    <div>
      <div className={`mb-1 text-sm ${theme === 'light' ? 'text-gray-700' : 'text-gray-100'}`}>{title}</div>
      <input
        className={cn(inputCls, 'mb-2')}
        value={q}
        maxLength={LIMITS.teamSearch}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onEnter}
        placeholder={placeholder || 'поиск по списку…'}
      />
      <div className="mb-2 flex flex-wrap gap-1">
        {values.map((s) => (
          <span
            key={s}
            className={
              theme === 'light'
                ? 'inline-flex items-center gap-1 rounded-full bg-black/10 px-2 py-1 text-xs text-gray-800 border border-black/10 backdrop-blur'
                : 'inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-1 text-xs text-gray-100 border border-white/10 backdrop-blur'
            }
          >
            {s}
            <button type="button" onClick={() => remove(s)} className="ml-1 hover:opacity-80">×</button>
          </span>
        ))}
      </div>

      <div
        className={cn(
          'mt-2 max-h-44 overflow-auto rounded-xl border border-black/10 dark:border-white/10 p-2 text-xs bg-white/60 dark:bg-white/[0.04] backdrop-blur',
          'nice-scrollbar'
        )}
      >
        {filtered.length === 0 ? (
          <div className={cn('py-6 text-center', theme === 'light' ? 'text-gray-500' : 'text-gray-400')}>
            Ничего не найдено
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {filtered.map((token) => (
              <button
                key={token}
                type="button"
                onClick={() => add(token)}
                className={cn(
                  'rounded-full px-2 py-1 transition-colors',
                  theme === 'light'
                    ? 'bg-black/5 text-gray-800 hover:bg-black/10'
                    : 'bg-white/[0.08] text-slate-200 hover:bg-white/[0.14]'
                )}
                title="Добавить"
              >
                {token}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LinksInput({
  label, theme, values, onChange, placeholder,
}: {
  label: string;
  theme: 'light' | 'dark';
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const MAX = 2;

  const [rows, setRows] = useState<string[]>(() =>
    values.length ? values.slice(0, MAX) : ['']
  );

  useEffect(() => {
    const sanitized = rows.map((s) => s.trim()).filter(Boolean).slice(0, MAX);
    onChange(sanitized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const inputBase =
    'w-full rounded-xl px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none transition-colors ' +
    '[appearance:auto] dark:[color-scheme:dark] light:[color-scheme:light]';
  const inputCls =
    theme === 'light'
      ? cn(inputBase, 'border border-black/10 bg-white/70 focus:border-black/25')
      : cn(inputBase, 'border border-white/10 bg-white/[0.04] text-white focus:border-white/25');

  const btnCls =
    'rounded-xl border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm transition-colors ' +
    'hover:bg-black/[0.04] dark:hover:bg-white/[0.06]';

  const plusDisabled = rows.length >= MAX;

  const update = (i: number, val: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[i] = val;
      return next;
    });
  };

  const addRow = () => { if (!plusDisabled) setRows((prev) => [...prev, '']); };
  const removeRow = (i: number) => {
    setRows((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      return next.length ? next : [''];
    });
  };

  return (
    <div>
      {label && (
        <div className={`mb-1 text-sm ${theme === 'light' ? 'text-gray-700' : 'text-gray-100'}`}>
          {label}
        </div>
      )}

      <div className="space-y-2">
        {rows.map((val, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              className={cn(inputCls, 'flex-1')}
              value={val}
              maxLength={LIMITS.url}
              onChange={(e) => update(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && i === rows.length - 1 && !plusDisabled) {
                  e.preventDefault();
                  addRow();
                }
              }}
              placeholder={placeholder || 'https://…'}
              inputMode="url"
            />
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(i)}
                className={btnCls}
                aria-label="Удалить строку"
                title="Удалить"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-2">
        <button
          type="button"
          onClick={addRow}
          className={cn(btnCls, plusDisabled && 'opacity-50 cursor-not-allowed')}
          disabled={plusDisabled}
          title={plusDisabled ? 'Можно максимум 2 ссылки' : 'Добавить строку'}
        >
          +
        </button>
      </div>
    </div>
  );
}
