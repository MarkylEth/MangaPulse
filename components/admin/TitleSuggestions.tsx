// components/admin/TitleSuggestions.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  Loader2, Trash2, Plus, Eye, XCircle, CheckCircle2, ExternalLink,
} from 'lucide-react';
import { useTheme } from '@/lib/theme/context';

/* ====================== types ====================== */

type RawSubmission = {
  id: string;
  type: 'title_add' | 'title_edit';
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at?: string | null;
  manga_id?: number | null;

  payload?: any;
  manga?: any;

  // автор заявки
  user_id?: string | null;
  author_name?: string | null;
  author_comment?: string | null;
  sources?: string[] | null;

  // снапшоты «до/после»
  snapshot_before?: any | null;
  snapshot_after?: any | null;

  // от API
  publisher?: string | null;
  translator_names?: string[] | null;
  release_formats?: string[] | null;
};

type UiItem = RawSubmission & { uiType: 'new_title' | 'edit' };

/* ==================== helpers ===================== */

const PROFILE_PATH = (slugOrName: string) => `/profile/${encodeURIComponent(slugOrName)}`;

function profileHref(row: RawSubmission): string | null {
  const name = (row.author_name || '').trim();
  if (!name) return null;
  return PROFILE_PATH(name);
}

function toStrList(v: any): string[] {
  if (v == null) return [];
  if (Array.isArray(v) && v.every(x => typeof x === 'string')) {
    return v.map(s => s.trim()).filter(Boolean);
  }
  if (Array.isArray(v)) {
    const arr = v
      .map(x => (x ? x.name ?? x.title ?? x.label ?? x.genre ?? x.value ?? '' : ''))
      .map(String).map(s => s.trim()).filter(Boolean);
    if (arr.length) return arr;
  }
  if (typeof v === 'object') {
    return toStrList(
      v.genres ?? v.genre ?? v.manga_genres ??
      v.tags ?? v.tag ?? v.list ?? v.values ?? v.names ??
      v.payload?.genres ?? v.payload?.genre ?? v.payload?.manga_genres ??
      v.payload?.tags
    );
  }
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return [];
    try { return toStrList(JSON.parse(s)); }
    catch { return s.split(/[,;|]\s*|\s{2,}|\n+/g).map(x => x.trim()).filter(Boolean); }
  }
  return [String(v)].filter(Boolean);
}

function toNameList(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) {
    return v
      .map((x) => (x && (x.name ?? x.title ?? x.label ?? x)) as any)
      .map((s) => String(s || '').trim())
      .filter(Boolean);
  }
  if (typeof v === 'string') return [v.trim()].filter(Boolean);
  if (typeof v === 'object') return toNameList(Object.values(v));
  return [];
}

function extractGenres(from: any) {
  return toStrList(from?.genres ?? from?.genre ?? from?.manga_genres ?? from?.payload?.genres ?? from?.payload?.genre);
}
function extractTags(from: any) {
  return toStrList(from?.tags ?? from?.tag_list ?? from?.payload?.tags);
}
function extractPublishers(from: any) {
  return toStrList(
    from?.publisher ?? from?.publishers ??
    from?.manga_publishers ?? from?.payload?.publisher ?? from?.payload?.publishers
  );
}
function extractReleaseFormats(from: any) {
  return toStrList(
    from?.release_formats ??
    from?.payload?.release_formats ??
    from?.release_format_keys ??
    from?.formats ?? from?.format
  );
}
function extractTranslatorNames(from: RawSubmission | any): string[] {
  const api = Array.isArray((from as any)?.translator_names) ? (from as any).translator_names : [];
  if (api.length) return api;
  return toNameList((from as any)?.payload?.translators ?? (from as any)?.translators);
}

function formatDT(s: string) {
  return new Date(s).toLocaleString('ru-RU', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

/* ---- Image helpers ---- */

function isValidImgSrc(src: any): src is string {
  if (typeof src !== 'string') return false;
  const s = src.trim();
  return s.startsWith('http://') || s.startsWith('https://') || s.startsWith('/');
}

function CoverBox({
  src, alt = 'cover', fill = false, width, height, className, sizes,
}: {
  src?: any; alt?: string; fill?: boolean; width?: number; height?: number; className?: string; sizes?: string;
}) {
  if (!isValidImgSrc(src)) {
    return <div className="flex h-full w-full items-center justify-center text-xs opacity-60">Нет обложки</div>;
  }
  return fill
    ? <Image src={src} alt={alt} fill sizes={sizes} className={className} />
    : <Image src={src} alt={alt} width={width!} height={height!} className={className} />;
}

/* Small presenter */
function Field({ label, value }: { label: string; value: unknown }) {
  const text =
    value == null
      ? '—'
      : Array.isArray(value)
      ? (value as unknown[]).length === 0 ? '—' : (value as unknown[]).map(String).join(', ')
      : typeof value === 'string'
      ? value.trim() === '' ? '—' : value
      : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value);
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="min-w-[140px] font-medium">{label}:</span>
      <span className="break-words">{text}</span>
    </div>
  );
}

/* ====== сравнение значений и нормализация для diff ====== */

function normString(v: any) {
  if (v == null) return '';
  return String(v).trim().replace(/\s+/g, ' ');
}
function normNumber(v: any) {
  if (v == null || v === '') return '';
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : normString(v);
}
function normList(v: any) {
  return toStrList(v).map(s => s.toLowerCase()).sort();
}
function equalish(a: any, b: any) {
  const aNum = Number(a); const bNum = Number(b);
  const bothNumericLike = Number.isFinite(aNum) && Number.isFinite(bNum);
  if (bothNumericLike) return aNum === bNum;

  if (Array.isArray(a) || Array.isArray(b)) {
    const aa = normList(a);
    const bb = normList(b);
    if (aa.length !== bb.length) return false;
    return aa.every((x, i) => x === bb[i]);
  }
  return normString(a) === normString(b);
}

/* =========== нормализация правки и мердж =========== */

function normalizeCurrent(m: any) {
  const tlStatus =
    m?.translation_status ??
    m?.translationStatus ??
    m?.status_translation ??
    m?.translate_status ??
    m?.tl_status ??
    null;

  const age =
    m?.age_rating ??
    m?.age ??
    m?.ageRating ??
    m?.age_restriction ??
    null;

  const kind =
    m?.type ??
    m?.kind ??
    m?.format ??
    m?.manga_type ??
    null;

  return {
    title: m?.title ?? null,
    title_romaji: m?.title_romaji ?? null,
    author: m?.author ?? null,
    artist: m?.artist ?? null,
    status: m?.status ?? null,
    translation_status: tlStatus,
    age_rating: age,
    release_year: m?.release_year ?? m?.year ?? null,
    type: kind,
    cover_url: m?.cover_url ?? null,
    description: m?.description ?? null,
    genres: extractGenres(m),
    tags: extractTags(m),
    publishers: extractPublishers(m),
    release_formats: extractReleaseFormats(m),
  };
}

function normalizeProposed(p: any, current: ReturnType<typeof normalizeCurrent>) {
  const proposedRaw = {
    title: p?.title_ru ?? p?.title ?? null,
    title_romaji: p?.title_romaji ?? null,
    author: p?.author ?? null,
    artist: p?.artist ?? null,
    status: p?.status ?? null,
    translation_status: p?.translation_status ?? null,
    age_rating: p?.age_rating ?? null,
    release_year: p?.release_year ?? p?.year ?? null,
    type: p?.type ?? null,
    cover_url: p?.cover_url ?? null,
    description: p?.description ?? null,
    genres: extractGenres(p),
    tags: extractTags(p),
    publishers: extractPublishers(p),
    release_formats: extractReleaseFormats(p),
  };

  return {
    title: proposedRaw.title ?? current.title,
    title_romaji: proposedRaw.title_romaji ?? current.title_romaji,
    author: proposedRaw.author ?? current.author,
    artist: proposedRaw.artist ?? current.artist,
    status: proposedRaw.status ?? current.status,
    translation_status: proposedRaw.translation_status ?? current.translation_status,
    age_rating: proposedRaw.age_rating ?? current.age_rating,
    release_year: proposedRaw.release_year ?? current.release_year,
    type: proposedRaw.type ?? current.type,
    cover_url: proposedRaw.cover_url ?? current.cover_url,
    description: proposedRaw.description ?? current.description,
    genres: proposedRaw.genres?.length ? proposedRaw.genres : current.genres,
    tags: proposedRaw.tags?.length ? proposedRaw.tags : current.tags,
    publishers: proposedRaw.publishers?.length ? proposedRaw.publishers : current.publishers,
    release_formats: proposedRaw.release_formats?.length ? proposedRaw.release_formats : current.release_formats,
  };
}

/* ============== Compact Diff Table ============== */

function DiffBadge() {
  return (
    <span className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold
      bg-rose-500/15 text-rose-600 dark:text-rose-300 dark:bg-rose-400/15 border border-rose-500/20">
      изм.
    </span>
  );
}

function renderVal(v: any) {
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
  if (v == null) return '—';
  const s = String(v).trim();
  return s === '' ? '—' : s;
}

function CellWrap({ changed, children }: { changed?: boolean; children: React.ReactNode }) {
  return (
    <div
      className={[
        "rounded-md px-2 py-1 text-sm break-words border",
        changed
          ? "border-rose-500/20 bg-rose-500/10"
          : "border-black/10 dark:border-white/10",
      ].join(' ')}
    >
      {children}
    </div>
  );
}

function TwoColsDiff({
  curr, next,
}: {
  curr: ReturnType<typeof normalizeCurrent>;
  next: ReturnType<typeof normalizeProposed>;
}) {
  const rows: { key: keyof typeof curr; label: string; isLong?: boolean; isImage?: boolean }[] = [
    { key: 'title',            label: 'Название' },
    { key: 'title_romaji',     label: 'Ромадзи' },
    { key: 'author',           label: 'Автор' },
    { key: 'artist',           label: 'Художник' },
    { key: 'status',           label: 'Статус тайтла' },
    { key: 'translation_status', label: 'Статус перевода' },
    { key: 'age_rating',       label: 'Возраст' },
    { key: 'release_year',     label: 'Год' },
    { key: 'type',             label: 'Тип' },
    { key: 'genres',           label: 'Жанры' },
    { key: 'tags',             label: 'Теги' },
    { key: 'publishers',       label: 'Издатель' },
    { key: 'release_formats',  label: 'Формат выпуска' },
    { key: 'description',      label: 'Описание', isLong: true },
    { key: 'cover_url',        label: 'Обложка', isImage: true },
  ];

  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-[180px_1fr_1fr] gap-2 text-xs font-medium text-gray-600 dark:text-gray-400">
        <div className="px-2">Поле</div>
        <div className="px-2">Было</div>
        <div className="px-2">Стало</div>
      </div>

      {rows.map(({ key, label, isLong, isImage }) => {
        const left = (curr as any)[key];
        const right = (next as any)[key];
        const changed = !equalish(left, right);

        if (isImage) {
          const box = (chg: boolean) =>
            `relative h-40 w-32 overflow-hidden rounded-md border ${chg
              ? 'border-rose-500/40 ring-1 ring-rose-500/30'
              : 'border-black/10 dark:border-white/10'}`;
          return (
            <div key={String(key)} className="grid grid-cols-[180px_1fr_1fr] gap-2 items-start">
              <div className="px-2 py-1 text-sm font-medium">{label}{changed ? <DiffBadge /> : null}</div>
              <div className="px-1 py-1">
                <div className={box(false)}>
                  <CoverBox src={left ?? undefined} width={128} height={160} className="h-full w-full object-cover" />
                </div>
              </div>
              <div className="px-1 py-1">
                <div className={box(changed)}>
                  <CoverBox src={right ?? undefined} width={128} height={160} className="h-full w-full object-cover" />
                </div>
              </div>
            </div>
          );
        }

        if (isLong) {
          return (
            <div key={String(key)} className="grid grid-cols-[180px_1fr_1fr] gap-2 items-start">
              <div className="px-2 py-1 text-sm font-medium">{label}{changed ? <DiffBadge /> : null}</div>
              <CellWrap>
                <div className="max-h-40 overflow-auto whitespace-pre-wrap">{(left?.trim?.() || renderVal(left))}</div>
              </CellWrap>
              <CellWrap changed={changed}>
                <div className="max-h-40 overflow-auto whitespace-pre-wrap">{(right?.trim?.() || renderVal(right))}</div>
              </CellWrap>
            </div>
          );
        }

        const leftText  = key === 'release_year' ? normNumber(left)  : renderVal(left);
        const rightText = key === 'release_year' ? normNumber(right) : renderVal(right);

        return (
          <div key={String(key)} className="grid grid-cols-[180px_1fr_1fr] gap-2 items-start">
            <div className="px-2 py-1 text-sm font-medium">{label}{changed ? <DiffBadge /> : null}</div>
            <CellWrap>{leftText}</CellWrap>
            <CellWrap changed={changed}>{rightText}</CellWrap>
          </div>
        );
      })}
    </div>
  );
}

/* ==================== data helpers ==================== */

async function fetchCurrentManga(mid: number): Promise<any | null> {
  try {
    const r1 = await fetch(`/api/manga/${mid}/bundle`, { cache: 'no-store' });
    const j1: any = await r1.json().catch(() => null);
    if (r1.ok && j1?.item) return j1.item;
  } catch {}
  try {
    const r2 = await fetch(`/api/manga/${mid}`, { cache: 'no-store' });
    const j2: any = await r2.json().catch(() => null);
    if (r2.ok && (j2?.item || j2?.manga)) return j2.item ?? j2.manga;
  } catch {}
  return null;
}

/* ==================== component ==================== */

export default function TitleSuggestionsPanel() {
  const { theme } = useTheme();
  const [items, setItems] = useState<UiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'new_title' | 'edit'>('all');
  const [selected, setSelected] = useState<UiItem | null>(null);

  const textClass = 'text-black dark:text-white';
  const mutedText = 'text-gray-600 dark:text-gray-400';
  const card = 'rounded-xl bg-black/5 dark:bg-[#1a1a1a] border border-black/10 dark:border-white/10';
  const inputClass =
    'rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-[#0f1115] text-black dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400';
  const btnSecondary =
    'inline-flex items-center gap-1 rounded-lg border border-black/10 dark:border-white/10 bg-black/10 hover:bg-black/15 dark:bg-white/10 dark:hover:bg-white/15 text-black dark:text-white px-3 py-2 text-sm transition-colors';
  const btnDanger =
    'inline-flex items-center gap-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 text-sm transition-colors dark:bg-rose-500 dark:hover:bg-rose-400 dark:text-black';
  const btnApprove =
    'inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 text-sm transition-colors dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-black';
  
  const STATUS_TEXT: Record<RawSubmission['status'], string> = {
    pending:  'на рассмотрении',
    approved: 'принято',
    rejected: 'отклонено',
  };
  
  function statusBadgeClass(st: RawSubmission['status']) {
    switch (st) {
      case 'approved':
        return 'rounded-full border border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-xs';
      case 'rejected':
        return 'rounded-full border border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-300 px-2 py-0.5 text-xs';
      default:
        return 'rounded-full border border-black/10 dark:border-white/10 bg-black/10 dark:bg-white/10 text-xs px-2 py-0.5';
    }
  }

  function resolveMangaId(row: UiItem): number | null {
    const mid = row.manga_id;
    if (typeof mid === 'number' && Number.isFinite(mid)) return mid;
    const p = row.payload ?? {};
    const pid = Number(p?.manga_id ?? p?.mangaId ?? NaN);
    return Number.isFinite(pid) ? pid : null;
  }

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/title-submissions', {
        cache: 'no-store',
        headers: { 'x-admin': '1' },
      });
      const txt = await res.text();
      const json = JSON.parse(txt || '{}');
      if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);

      let mapped: UiItem[] = (json.items || []).map((row: RawSubmission) => ({
        ...row,
        uiType: row.type === 'title_add' ? 'new_title' : 'edit',
      }));

      const NEED_KEYS = ['translation_status', 'age_rating', 'type'] as const;
      const toEnrich = mapped.filter(
        r =>
          r.uiType === 'edit' &&
          (!r.manga || NEED_KEYS.some(k => (r.manga as any)?.[k] == null))
      );

      if (toEnrich.length) {
        const enriched = await Promise.all(
          toEnrich.map(async (r) => {
            const mid = resolveMangaId(r);
            if (!mid) return { id: r.id, manga: r.manga ?? null };
            const curr = await fetchCurrentManga(mid);
            const merged = curr ? { ...curr, ...(r.manga ?? {}) } : (r.manga ?? null);
            return { id: r.id, manga: merged };
          })
        );
        const mapById = new Map(enriched.map(e => [e.id, e.manga]));
        mapped = mapped.map(r => (mapById.has(r.id) ? { ...r, manga: mapById.get(r.id) } : r));
      }

      setItems(mapped);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(
    () => items.filter(x => (filter === 'all' ? true : x.uiType === filter)),
    [items, filter],
  );

  const newTitleCount = items.filter(i => i.uiType === 'new_title' && i.status === 'pending').length;
  const editCount = items.filter(i => i.uiType === 'edit' && i.status === 'pending').length;

  function countChanges(curr: ReturnType<typeof normalizeCurrent>, next: ReturnType<typeof normalizeProposed>) {
    const fields: (keyof typeof curr)[] = [
      'title','title_romaji','author','artist','status','translation_status',
      'age_rating','release_year','type','cover_url','description','genres','tags',
      'publishers','release_formats',
    ];
    return fields.reduce((acc, k) => acc + (equalish((curr as any)[k], (next as any)[k]) ? 0 : 1), 0);
  }

  async function act(row: UiItem, action: 'approve' | 'reject') {
    try {
      setBusy(row.id);
      setItems(prev => prev.map(x => (x.id === row.id ? { ...x, status: action === 'approve' ? 'approved' : 'rejected' } : x)));

      const maybeMid = row.uiType === 'edit' ? resolveMangaId(row) : null;
      const body: any = { id: row.id, action };
      if (maybeMid != null) body.manga_id = maybeMid;

      if (row.uiType === 'edit') {
        const current = normalizeCurrent(row.manga ?? {});
        const resolved = normalizeProposed(row.payload ?? {}, current);
        body.resolvedPayload = resolved;
      }

      const res = await fetch('/api/admin/title-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin': '1' },
        body: JSON.stringify(body),
      });
      const txt = await res.text();
      const json = JSON.parse(txt || '{}');
      if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      await load();
    } catch (e: any) {
      alert(e?.message || 'Ошибка');
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className={`text-xl font-semibold ${textClass}`}>Заявки на правки и новые тайтлы</div>
        <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
          <button onClick={load} className={btnSecondary}>Обновить</button>
          <button
            onClick={async () => {
              if (!confirm('Удалить все обработанные заявки?')) return;
              const res = await fetch('/api/admin/title-submissions?cleanup=done', {
                method: 'DELETE', headers: { 'x-admin': '1' },
              });
              const json = await res.json().catch(() => ({}));
              if (!res.ok || !json?.ok) return alert(json?.error || `HTTP ${res.status}`);
              setItems(prev => prev.filter(x => x.status === 'pending'));
            }}
            className={btnDanger}
          >
            <Trash2 className="h-4 w-4" /> Очистить обработанные
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${textClass}`}>Фильтр:</span>
          <select value={filter} onChange={e => setFilter(e.target.value as any)} className={inputClass}>
            <option value="all">Все ({items.length})</option>
            <option value="new_title">Новые тайтлы ({newTitleCount})</option>
            <option value="edit">Правки ({editCount})</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className={`flex items-center gap-2 text-sm ${mutedText}`}>
          <Loader2 className="h-4 w-4 animate-spin" /> Загрузка…
        </div>
      )}

      {error && (
        <div className={`${card} p-3 border-red-300/60 dark:border-red-400/30 bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-200`}>
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className={`${card} p-6 ${mutedText}`}>Пока заявок нет</div>
      )}

      <div className="grid gap-4">
        {filtered.map((row) => {
          const isNewTitle = row.uiType === 'new_title';

          const m = normalizeCurrent(row.manga ?? {}); // как было
          const pResolved = isNewTitle ? null : normalizeProposed(row.payload ?? {}, m);
          
          const hasSnap = !!(row.snapshot_before && row.snapshot_after);
          const baseCurr = hasSnap ? normalizeCurrent(row.snapshot_before) : m;
          const baseNext = hasSnap ? normalizeProposed(row.snapshot_after, baseCurr) : (pResolved!);
          
          const changes = !isNewTitle ? countChanges(baseCurr, baseNext) : 0;

          const genres = extractGenres(row.payload).join(', ');
          const tags = extractTags(row.payload).join(', ');
          const publishersHuman = (row.publisher && row.publisher.trim())
            ? row.publisher
            : extractPublishers(row.payload).join(', ');
          const releaseFormatsHuman = (Array.isArray(row.release_formats) && row.release_formats.length)
            ? row.release_formats
            : extractReleaseFormats(row.payload);

          const translatorNames = extractTranslatorNames(row);

          const href = profileHref(row);

          return (
            <div key={row.id} className={`${card} p-4`}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                      isNewTitle ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300'
                                 : 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300'
                    }`}
                  >
                    {isNewTitle ? <Plus className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {isNewTitle ? 'Новый тайтл' : 'Правка'}
                  </span>
                  {!isNewTitle && (
                    <span className="text-xs rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 px-2 py-0.5">
                      изменено полей: <b>{changes}</b>
                    </span>
                  )}
                  <div className={`text-sm ${textClass}`}>
                    <b>#{row.id}</b>
                    {!isNewTitle && <> • Тайтл: <b>#{row.manga_id ?? '—'}</b></>}
                    {' '}• отправил:{' '}
                    {href ? (
                      <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:opacity-80">
                        <b>{row.author_name}</b>
                      </a>
                    ) : (
                      <b>{row.author_name || '—'}</b>
                    )}{' '}
                    <span className={statusBadgeClass(row.status)}>
                      {STATUS_TEXT[row.status]}
                    </span>
                  </div>
                </div>
                <div className={`text-xs ${mutedText}`}>{formatDT(row.created_at)}</div>
              </div>

              {isNewTitle ? (
                <div className="space-y-3">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      <div className="relative h-48 w-36 overflow-hidden rounded-md border border-black/10 dark:border-white/10">
                        <CoverBox src={row.payload?.cover_url} alt="cover" fill sizes="144px" className="object-cover" />
                      </div>
                    </div>
                    <div className="flex-1 space-y-2">
                      <h3 className={`text-lg font-semibold ${textClass}`}>{row.payload?.title_ru || row.payload?.title || 'Без названия'}</h3>
                      {row.payload?.title_romaji && <p className={`text-sm ${mutedText}`}>{row.payload.title_romaji}</p>}
                      <div className={`grid grid-cols-2 gap-3 text-sm ${mutedText}`}>
                        <Field label="Автор" value={(row as any).author ?? row.payload?.author} />
                        <Field label="Художник" value={(row as any).artist ?? row.payload?.artist} />
                        <Field label="Издатель" value={publishersHuman} />
                        <Field label="Статус" value={row.payload?.status} />
                        <Field label="Перевод" value={row.payload?.translation_status} />
                        <Field label="Возраст" value={row.payload?.age_rating} />
                        <Field label="Год" value={row.payload?.release_year} />
                        <Field label="Тип" value={row.payload?.type} />
                        <Field label="Жанры" value={genres} />
                        <Field label="Теги" value={tags} />
                        <Field label="Формат выпуска" value={releaseFormatsHuman} />
                        <Field label="Команда переводчиков" value={translatorNames} />
                      </div>
                      {row.payload?.description && (
                        <div className={`text-sm ${textClass}`}>
                          <span className="font-medium">Описание: </span>
                          <p className={`mt-1 text-xs ${mutedText} line-clamp-3`}>{row.payload.description}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <TwoColsDiff curr={baseCurr} next={baseNext} />
              )}

              {/* Автор заявки/комментарии/ссылки */}
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex items-start gap-2 text-sm">
                  <span className="min-w-[140px] font-medium">Автор заявки:</span>
                  <span className="break-words">
                    {href ? (
                      <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:opacity-80">
                        {row.author_name}
                      </a>
                    ) : (row.author_name || '—')}
                  </span>
                </div>
                <Field label="Комментарий" value={row.author_comment || '—'} />
                <div>
                  <div className="font-medium">Ссылки на оригинал</div>
                  {Array.isArray(row.sources) && row.sources.length ? (
                    <div className="space-y-1 mt-1">
                      {row.sources.map((u, i) => (
                        <a key={`${u}-${i}`} href={u} target="_blank" className="text-sm underline break-all" rel="noreferrer">
                          {u}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className={`${mutedText}`}>Пусто</div>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                {row.status === 'pending' && (
                  <>
                    <button
                      disabled={busy === row.id}
                      onClick={() => act(row, 'approve')}
                      className={btnApprove}
                    >
                      {busy === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Одобрить
                    </button>
                    <button
                      disabled={busy === row.id}
                      onClick={() => act(row, 'reject')}
                      className={btnDanger}
                    >
                      {busy === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                      Отклонить
                    </button>
                  </>
                )}

                <button onClick={() => setSelected(row)} className={btnSecondary}>Подробнее</button>

                {resolveMangaId(row) ? (
                  <a
                    href={`/title/${resolveMangaId(row)}`}
                    target="_blank" rel="noreferrer"
                    className={btnSecondary}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Открыть
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-sm md:backdrop-blur"
            onClick={() => setSelected(null)}
          />
          <div className={`relative z-10 w-full max-w-4xl max-h-[90vh] overflow-auto rounded-2xl p-6 border border-black/10 dark:border-white/10 shadow-[0_20px_80px_rgba(0,0,0,.6)] bg-white/80 dark:bg-[#0f1115]/80 backdrop-blur-xl`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className={`text-xl font-semibold ${textClass}`}>
                  {selected.uiType === 'new_title'
                    ? selected.payload?.title_ru || selected.payload?.title || 'Без названия'
                    : selected.manga?.title || 'Правка'}
                </div>
                <div className={`text-xs ${mutedText} mt-1`}>Создано: {formatDT(selected.created_at)}</div>
                <div className={`text-xs ${mutedText} mt-0.5`}>
                  Отправил:{' '}
                  {profileHref(selected) ? (
                    <a href={profileHref(selected)!} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:opacity-80">
                      {selected.author_name}
                    </a>
                  ) : (selected.author_name || '—')}
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg px-3 py-2 hover:bg-black/10 dark:hover:bg-white/10"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {selected.uiType === 'new_title' ? (
              <div className="grid gap-6 md:grid-cols-[180px_1fr]">
                <div className="relative h-[260px] w-[180px] overflow-hidden rounded-md border border-black/10 dark:border-white/10">
                  <CoverBox src={selected.payload?.cover_url} alt="cover" fill sizes="180px" className="object-cover" />
                </div>
                <div className={`space-y-2 ${textClass}`}>
                  <Field label="Автор" value={(selected as any).author ?? selected.payload?.author} />
                  <Field label="Художник" value={(selected as any).artist ?? selected.payload?.artist} />
                  <Field
                    label="Издатель"
                    value={
                      (selected.publisher && selected.publisher.trim())
                        ? selected.publisher
                        : extractPublishers(selected.payload).join(', ')
                    }
                  />
                  <Field label="Статус" value={selected.payload?.status} />
                  <Field label="Перевод" value={selected.payload?.translation_status} />
                  <Field label="Возраст" value={selected.payload?.age_rating} />
                  <Field label="Год" value={selected.payload?.release_year} />
                  <Field label="Тип" value={selected.payload?.type} />
                  <Field label="Жанры" value={extractGenres(selected.payload).join(', ')} />
                  <Field label="Теги" value={extractTags(selected.payload).join(', ')} />
                  <Field label="Формат выпуска" value={extractReleaseFormats(selected).length ? extractReleaseFormats(selected) : extractReleaseFormats(selected.payload)} />
                  <Field label="Команда переводчиков" value={extractTranslatorNames(selected)} />
                  {selected.payload?.description && (
                    <div className="pt-2">
                      <div className="text-sm font-medium">Описание</div>
                      <div className={`text-sm ${mutedText} whitespace-pre-wrap`}>
                        {selected.payload.description}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              (() => {
                const curr = normalizeCurrent(selected.manga ?? {});
                const proposed = normalizeProposed(selected.payload ?? {}, curr);
                return <TwoColsDiff curr={curr} next={proposed} />;
              })()
            )}

            <div className="mt-4 space-y-1">
              <div className="flex items-start gap-2 text-sm">
                <span className="min-w-[140px] font-medium">Автор заявки:</span>
                <span className="break-words">
                  {profileHref(selected) ? (
                    <a href={profileHref(selected)!} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:opacity-80">
                      {selected.author_name}
                    </a>
                  ) : (selected.author_name || '—')}
                </span>
              </div>
              <Field label="Комментарий" value={selected.author_comment || '—'} />
              <div>
                <div className="text-sm font-medium">Ссылки на оригинал</div>
                {Array.isArray(selected.sources) && selected.sources.length ? (
                  <div className="space-y-1 mt-1">
                    {selected.sources.map((u, i) => (
                      <a key={`${u}-${i}`} href={u} target="_blank" className="text-sm underline break-all" rel="noreferrer">
                        {u}
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className={`text-sm ${mutedText}`}>Пусто</div>
                )}
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2">
              {selected.status === 'pending' && (
                <>
                  <button
                    onClick={() => act(selected, 'approve')}
                    className={btnApprove}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Одобрить
                  </button>
                  <button
                    onClick={() => act(selected, 'reject')}
                    className={btnDanger}
                  >
                    <XCircle className="h-4 w-4" /> Отклонить
                  </button>
                </>
              )}
              <button onClick={() => setSelected(null)} className={btnSecondary}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
