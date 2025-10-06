// components/TitleSuggestionsPanel.tsx
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

  payload?: any;  // предложенные изменения
  manga?: any;    // текущее состояние (для правок)

  author_name?: string | null;       // кто отправил
  author_comment?: string | null;
  sources?: string[] | null;
};

type UiItem = RawSubmission & { uiType: 'new_title' | 'edit' };

/* ==================== helpers ===================== */

function toStrList(v: any): string[] {
  if (v == null) return [];
  if (Array.isArray(v) && v.every(x => typeof x === 'string')) {
    return v.map(s => s.trim()).filter(Boolean);
  }
  if (Array.isArray(v)) {
    const arr = v
      .map(x => (x ? x.name ?? x.genre ?? x.title ?? x.value ?? '' : ''))
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

function extractGenres(from: any) {
  return toStrList(from?.genres ?? from?.genre ?? from?.manga_genres ?? from?.payload?.genres ?? from?.payload?.genre);
}
function extractTags(from: any) {
  return toStrList(from?.tags ?? from?.tag_list ?? from?.payload?.tags);
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
      <span className="min-w-[110px] font-medium">{label}:</span>
      <span className="break-words">{text}</span>
    </div>
  );
}

/* =========== нормализация правки и мердж =========== */

/** Текущая запись из БД в плоский вид для сравнения/рендера (с поддержкой синонимов ключей) */
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
    release_year: m?.release_year ?? null,
    type: kind,
    cover_url: m?.cover_url ?? null,
    description: m?.description ?? null,
  };
}

/** Предложенные изменения, с подстановкой текущих значений для неизм. полей */
function normalizeProposed(p: any, current: ReturnType<typeof normalizeCurrent>) {
  const proposedRaw = {
    title: p?.title_ru ?? p?.title ?? null,
    title_romaji: p?.title_romaji ?? null,
    author: p?.author ?? null,
    artist: p?.artist ?? null,
    status: p?.status ?? null,
    translation_status: p?.translation_status ?? null,
    age_rating: p?.age_rating ?? null,
    release_year: p?.release_year ?? null,
    type: p?.type ?? null,
    cover_url: p?.cover_url ?? null,
    description: p?.description ?? null,
  };

  // fallback — если поле не прислали, считаем «без изменений»
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
    cover_url: proposedRaw.cover_url ?? current.cover_url, // ❗ обложка не сбрасывается
    description: proposedRaw.description ?? current.description,
  };
}

/* ===================== ui chunks ===================== */

function TwoCols({
  titleL, dataL, titleR, dataR,
}: {
  titleL: string; dataL: any; titleR: string; dataR: any;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <div className="mb-2 font-medium">{titleL}</div>
        <div className="space-y-1">
          <Field label="Название" value={dataL.title} />
          <Field label="Ромадзи" value={dataL.title_romaji} />
          <Field label="Автор" value={dataL.author} />
          <Field label="Художник" value={dataL.artist} />
          <Field label="Статус тайтла" value={dataL.status} />
          <Field label="Статус перевода" value={dataL.translation_status} />
          <Field label="Возраст" value={dataL.age_rating} />
          <Field label="Год" value={dataL.release_year} />
          <Field label="Тип" value={dataL.type} />
          {dataL.cover_url && (
            <>
              <div className="mt-2 text-sm">Обложка:</div>
              <div className="mt-1 h-40 w-32 overflow-hidden rounded-md border">
                <CoverBox src={dataL.cover_url} width={128} height={160} className="h-full w-full object-cover" />
              </div>
            </>
          )}
          {dataL.description && (
            <>
              <div className="mt-2 text-sm font-medium">Описание:</div>
              <div className="text-xs opacity-80 line-clamp-6">{dataL.description}</div>
            </>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 font-medium">{titleR}</div>
        <div className="space-y-1">
          <Field label="Название" value={dataR.title} />
          <Field label="Ромадзи" value={dataR.title_romaji} />
          <Field label="Автор" value={dataR.author} />
          <Field label="Художник" value={dataR.artist} />
          <Field label="Статус тайтла" value={dataR.status} />
          <Field label="Статус перевода" value={dataR.translation_status} />
          <Field label="Возраст" value={dataR.age_rating} />
          <Field label="Год" value={dataR.release_year} />
          <Field label="Тип" value={dataR.type} />
          {dataR.cover_url && (
            <>
              <div className="mt-2 text-sm">Обложка:</div>
              <div className="mt-1 h-40 w-32 overflow-hidden rounded-md border">
                <CoverBox src={dataR.cover_url} width={128} height={160} className="h-full w-full object-cover" />
              </div>
            </>
          )}
          {dataR.description && (
            <>
              <div className="mt-2 text-sm font-medium">Описание:</div>
              <div className="text-xs opacity-80 line-clamp-6">{dataR.description}</div>
            </>
          )}
        </div>
      </div>
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

  const card = theme === 'light' ? 'bg-white border-gray-200' : 'bg-gray-900/40 border-white/10';
  const badge =
    theme === 'light'
      ? 'rounded-full border px-2 py-0.5 text-xs bg-gray-100 border-gray-200'
      : 'rounded-full border px-2 py-0.5 text-xs bg-slate-800/60 border-white/10';

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

      // Догружаем недостающие поля «текущего» для правок
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

  /** действия модерации; для правок отправляем resolvedPayload (мердж с текущим) */
  async function act(row: UiItem, action: 'approve' | 'reject') {
    try {
      setBusy(row.id);
      // optimistic
      setItems(prev => prev.map(x => (x.id === row.id ? { ...x, status: action === 'approve' ? 'approved' : 'rejected' } : x)));

      const maybeMid = row.uiType === 'edit' ? resolveMangaId(row) : null;
      const body: any = { id: row.id, action };

      if (maybeMid != null) body.manga_id = maybeMid;

      // для title_edit подготовим payload, где незаполненные поля заменены текущими
      if (row.uiType === 'edit') {
        const current = normalizeCurrent(row.manga ?? {});
        const resolved = normalizeProposed(row.payload ?? {}, current);
        body.resolvedPayload = resolved; // бэкенд может принять и обновить по нему
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
      <div className="flex items-center justify-between">
        <div className="text-xl font-semibold">Заявки на правки и новые тайтлы</div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="rounded-lg border px-3 py-2 text-sm">Обновить</button>
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
            className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-2 text-sm text-white"
          >
            <Trash2 className="h-4 w-4" /> Очистить обработанные
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Фильтр:</span>
          <select value={filter} onChange={e => setFilter(e.target.value as any)} className="rounded border px-3 py-1 text-sm">
            <option value="all">Все ({items.length})</option>
            <option value="new_title">Новые тайтлы ({newTitleCount})</option>
            <option value="edit">Правки ({editCount})</option>
          </select>
        </div>
      </div>

      {loading && (<div className="flex items-center gap-2 text-sm opacity-70"><Loader2 className="h-4 w-4 animate-spin" /> Загрузка…</div>)}
      {error && (
        <div className={`rounded-xl border p-3 ${theme === 'light' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-red-500/10 border-red-500/30 text-red-100'}`}>
          {error}
        </div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-xl border p-6 opacity-70">Пока заявок нет</div>
      )}

      <div className="grid gap-4">
        {filtered.map((row) => {
          const isNewTitle = row.uiType === 'new_title';
          const m = normalizeCurrent(row.manga ?? {});
          const pResolved = isNewTitle ? null : normalizeProposed(row.payload ?? {}, m);

          const genres = extractGenres(row.payload).join(', ');
          const tags = extractTags(row.payload).join(', ');

          return (
            <div key={row.id} className={`rounded-xl border p-4 ${card}`}>
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
                  <div className="text-sm">
                    <b>#{row.id}</b>
                    {!isNewTitle && <> • Тайтл: <b>#{row.manga_id ?? resolveMangaId(row) ?? '—'}</b></>}
                    {' '}• отправил: <b>{row.author_name || 'неизвестно'}</b>{' '}
                    <span className={badge}>{row.status}</span>
                  </div>
                </div>
                <div className="text-xs opacity-70">{formatDT(row.created_at)}</div>
              </div>

              {isNewTitle ? (
                <div className="space-y-3">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      <div className="relative h-48 w-36 overflow-hidden rounded-md border">
                        <CoverBox src={row.payload?.cover_url} alt="cover" fill sizes="144px" className="object-cover" />
                      </div>
                    </div>
                    <div className="flex-1 space-y-2">
                      <h3 className="text-lg font-semibold">{row.payload?.title_ru || row.payload?.title || 'Без названия'}</h3>
                      {row.payload?.title_romaji && <p className="text-sm opacity-70">{row.payload.title_romaji}</p>}
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <Field label="Автор" value={row.payload?.author} />
                        <Field label="Художник" value={row.payload?.artist} />
                        <Field label="Статус" value={row.payload?.status} />
                        <Field label="Перевод" value={row.payload?.translation_status} />
                        <Field label="Возраст" value={row.payload?.age_rating} />
                        <Field label="Год" value={row.payload?.release_year} />
                        <Field label="Тип" value={row.payload?.type} />
                        <Field label="Жанры" value={genres} />
                        <Field label="Теги" value={tags} />
                      </div>
                      {row.payload?.description && (
                        <div className="text-sm">
                          <span className="font-medium">Описание: </span>
                          <p className="mt-1 text-xs opacity-80 line-clamp-3">{row.payload.description}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <TwoCols
                  titleL="Текущее"
                  dataL={m}
                  titleR="Предлагается"
                  dataR={pResolved}
                />
              )}

              {/* Автор заявки/комментарии/ссылки */}
              <div className="mt-3 space-y-1 text-sm">
                <Field label="Автор заявки" value={row.author_name || '—'} />
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
                    <div className="opacity-70">Пусто</div>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                {row.status === 'pending' && (
                  <>
                    <button
                      disabled={busy === row.id}
                      onClick={() => act(row, 'approve')}
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                    >
                      {busy === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Одобрить
                    </button>
                    <button
                      disabled={busy === row.id}
                      onClick={() => act(row, 'reject')}
                      className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                    >
                      {busy === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                      Отклонить
                    </button>
                  </>
                )}

                <button onClick={() => setSelected(row)} className="rounded-md border px-3 py-1.5 text-sm">Подробнее</button>

                {resolveMangaId(row) ? (
                  <a
                    href={`/manga/${resolveMangaId(row)}`}
                    target="_blank" rel="noreferrer"
                    className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm ${
                      theme === 'light' ? 'bg-blue-600 text-white' : 'bg-blue-500 text-black'
                    }`}
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
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelected(null)} />
          <div className={`relative z-10 w-full max-w-4xl max-h-[90vh] overflow-auto rounded-2xl border p-6 ${card}`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-xl font-semibold">
                  {selected.uiType === 'new_title'
                    ? selected.payload?.title_ru || selected.payload?.title || 'Без названия'
                    : selected.manga?.title || 'Правка'}
                </div>
                <div className="text-xs opacity-70 mt-1">Создано: {formatDT(selected.created_at)}</div>
                <div className="text-xs opacity-70 mt-0.5">Отправил: {selected.author_name || 'неизвестно'}</div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className={`rounded-lg p-2 ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-gray-800'}`}
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {selected.uiType === 'new_title' ? (
              <>
                <div className="grid gap-6 md:grid-cols-[180px_1fr]">
                  <div className="relative h-[260px] w-[180px] overflow-hidden rounded-md border">
                    <CoverBox src={selected.payload?.cover_url} alt="cover" fill sizes="180px" className="object-cover" />
                  </div>
                  <div className="space-y-2">
                    <Field label="Автор" value={selected.payload?.author} />
                    <Field label="Художник" value={selected.payload?.artist} />
                    <Field label="Статус" value={selected.payload?.status} />
                    <Field label="Перевод" value={selected.payload?.translation_status} />
                    <Field label="Возраст" value={selected.payload?.age_rating} />
                    <Field label="Год" value={selected.payload?.release_year} />
                    <Field label="Тип" value={selected.payload?.type} />
                    <Field label="Жанры" value={extractGenres(selected.payload).join(', ')} />
                    <Field label="Теги" value={extractTags(selected.payload).join(', ')} />
                    {selected.payload?.description && (
                      <div className="pt-2">
                        <div className="text-sm font-medium">Описание</div>
                        <div className="text-sm opacity-80 whitespace-pre-wrap">
                          {selected.payload.description}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              (() => {
                const curr = normalizeCurrent(selected.manga ?? {});
                const proposed = normalizeProposed(selected.payload ?? {}, curr);
                return (
                  <TwoCols
                    titleL="Текущее"
                    dataL={curr}
                    titleR="Предлагается"
                    dataR={proposed}
                  />
                );
              })()
            )}

            {/* блок «кто отправил/коммент/ссылки» */}
            <div className="mt-4 space-y-1">
              <Field label="Автор заявки" value={selected.author_name || '—'} />
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
                  <div className="text-sm opacity-70">Пусто</div>
                )}
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2">
              {selected.status === 'pending' && (
                <>
                  <button
                    onClick={() => act(selected, 'approve')}
                    className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm text-white"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Одобрить
                  </button>
                  <button
                    onClick={() => act(selected, 'reject')}
                    className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-sm text-white"
                  >
                    <XCircle className="h-4 w-4" /> Отклонить
                  </button>
                </>
              )}
              <button onClick={() => setSelected(null)} className="rounded-md border px-4 py-2 text-sm">
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
