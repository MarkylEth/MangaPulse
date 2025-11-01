//components\admin\CommentModeration.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Search, Loader2, RefreshCw, AlertTriangle, Trash2, Filter, MessageSquare,
  ShieldAlert, CheckCircle2, EyeOff, UserRound, ExternalLink, X
} from "lucide-react";
import { useTheme } from "@/lib/theme/context";

/* ===================== Types ===================== */
type ApiComment = {
  id: string;
  source: "manga" | "page" | "post";
  target_id: string | null;
  target_title?: string | null;
  content: string;
  created_at: string;
  author_id?: string | null;
  author_name?: string | null;
  reports_count?: number;
  is_hidden?: boolean;
  whitelisted?: boolean; // ДОБАВЛЕНО
};
type ApiResponse = { ok: true; items: ApiComment[]; total: number };

type UIComment = {
  id: string;
  source: "manga" | "page" | "post";
  target_id: string | null;
  target_title?: string | null;
  body: string;
  created_at: string;
  author_id?: string | null;
  author_name?: string | null;
  reports: number;
  hidden: boolean;
  whitelisted: boolean; // ДОБАВЛЕНО
  raw: ApiComment;
};

type ReportItem = {
  id: number;
  reason: string;
  details: string | null;
  status: string;
  created_at: string | null;
  resolved_at: string | null;
  user_id: string | null;
  user_name: string | null;
};

type BannedItem = {
  pattern: string;
  kind?: "word" | "phrase" | "regex";
  severity?: number;
};

function mapApiToUI(c: ApiComment): UIComment {
  return {
    id: c.id,
    source: c.source,
    target_id: c.target_id ?? null,
    target_title: c.target_title ?? null,
    body: String(c.content ?? ""),
    created_at: c.created_at,
    author_id: c.author_id ?? null,
    author_name: c.author_name ?? null,
    reports: Number(c.reports_count ?? 0),
    hidden: Boolean(c.is_hidden),
    whitelisted: Boolean(c.whitelisted), // ДОБАВЛЕНО
    raw: c,
  };
}

/* ===================== utils ===================== */
async function fetchJson<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text || "{}"); } catch { data = {}; }
  if (!res.ok || data?.ok === false) {
    const msg = data?.error || data?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

function makeTargetUrl(src: UIComment["source"], id: string | null) {
  if (!id) return null;
  if (src === "manga") return `/title/${id}`;
  if (src === "page")  return `/page/${id}`;
  return `/post/${id}`;
}
function makeAuthorUrl(id?: string | null) {
  if (!id) return null;
  return `/profile/${id}`;
}

// html escape
function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
/** Экранируем под RegExp + нормализуем е/ё */
function escReWithYo(s: string) {
  const esc = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return esc.replace(/[её]/gi, (m) => (m === m.toUpperCase() ? "[ЕЁ]" : "[её]"));
}

/* ===================== Component ===================== */
export default function CommentModeration() {
  const { theme } = useTheme();

  const [items, setItems] = useState<UIComment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [source, setSource] = useState<"all" | "manga" | "page" | "post">("all");

  // бан-паттерны
  const [banned, setBanned] = useState<BannedItem[]>([]);

  // модалка жалоб
  const [repOpen, setRepOpen] = useState(false);
  const [repLoading, setRepLoading] = useState(false);
  const [repError, setRepError] = useState<string | null>(null);
  const [repItems, setRepItems] = useState<ReportItem[]>([]);
  const [repFor, setRepFor] = useState<UIComment | null>(null);

  const LIMIT = 50;
  const [nextOffset, setNextOffset] = useState(0);
  const hasMore = items.length < total;

  const textClass  = "text-black dark:text-white";
  const mutedText  = "text-gray-600 dark:text-gray-400";
  const cardBg     = "rounded-xl border bg-black/5 dark:bg-[#1a1a1a] border-black/10 dark:border-white/10";
  const inputBase  = "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2";
  const inputClass = `${inputBase} border-black/10 dark:border-white/10 bg-white dark:bg-[#0f1115] text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-indigo-500/50 dark:focus:ring-indigo-400/40`;
  const btnNeutral = "inline-flex items-center gap-2 rounded-lg border border-black/10 dark:border-white/10 bg-black/10 hover:bg-black/15 dark:bg-white/10 dark:hover:bg-white/15 transition-colors";

  // загрузка бан-листа (полные данные)
  useEffect(() => {
    (async () => {
      try {
        const uiLang = typeof navigator !== "undefined" ? (navigator.language?.split("-")[0]?.toLowerCase() || "any") : "any";
        type Wire = { pattern: string; kind?: string; severity?: number } | string;
        const data = await fetchJson<{ ok: true; items: Wire[] }>(`/api/moderation/banned?full=1&lang=${uiLang}`);
        const list: BannedItem[] = (data.items || [])
          .map((it) =>
            typeof it === "string"
              ? { pattern: it, kind: "phrase" as const }
              : {
                  pattern: String((it as any)?.pattern || "").trim(),
                  kind: (String((it as any)?.kind || "phrase") as "word" | "phrase" | "regex"),
                  severity: Number((it as any)?.severity ?? 0),
                })
          .filter((x) => x.pattern.length > 0);
        setBanned(list);
      } catch {
        setBanned([]);
      }
    })();
  }, []);

  /* ===== Бан-движок: hasBanned() и highlight() на общих регэкспах ===== */
  const banEngine = useMemo(() => {
    const words   = banned.filter(b => (b.kind || "phrase") === "word").map(b => escReWithYo(b.pattern));
    const phrases = banned.filter(b => (b.kind || "phrase") === "phrase").map(b => escReWithYo(b.pattern));
    const customs = banned.filter(b => b.kind === "regex").map(b => b.pattern);

    let wordRe: RegExp | null = null;
    let phraseRe: RegExp | null = null;
    const customRes: RegExp[] = [];

    try { if (words.length)   wordRe   = new RegExp(`(?<!\\p{L})(?:${words.join("|")})(?!\\p{L})`, "giu"); } catch { wordRe = null; }
    try { if (phrases.length) phraseRe = new RegExp(`(?:${phrases.join("|")})`, "giu"); } catch { phraseRe = null; }
    for (const p of customs) { try { customRes.push(new RegExp(p, "giu")); } catch {} }

    const testRe = (re: RegExp, s: string) => { re.lastIndex = 0; return re.test(s); };

    const hasBanned = (body: string): boolean => {
      if (!body) return false;
      if (wordRe && testRe(wordRe, body)) return true;
      if (phraseRe && testRe(phraseRe, body)) return true;
      for (const re of customRes) { if (testRe(re, body)) return true; }
      return false;
    };

    const highlight = (body: string) => {
      if (!wordRe && !phraseRe && customRes.length === 0) return { __html: escapeHtml(body) };
      const START = "\u0000", END = "\u0001";
      let marked = body;
      if (wordRe)   { wordRe.lastIndex = 0;   marked = marked.replace(wordRe,   m => `${START}${m}${END}`); }
      if (phraseRe) { phraseRe.lastIndex = 0; marked = marked.replace(phraseRe, m => `${START}${m}${END}`); }
      for (const re of customRes) { re.lastIndex = 0; marked = marked.replace(re, m => `${START}${m}${END}`); }

      const escaped = escapeHtml(marked);
      const html = escaped
        .replaceAll(START, `<mark class="bg-yellow-500/30 text-current rounded px-0.5">`)
        .replaceAll(END, `</mark>`);
      return { __html: html };
    };

    return { hasBanned, highlight };
  }, [banned]);

  async function loadPage(reset = false) {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      sp.set("limit", String(LIMIT));
      sp.set("offset", String(reset ? 0 : nextOffset));
      sp.set("source", source);
      if (searchQuery) sp.set("q", searchQuery);

      const data = await fetchJson<ApiResponse>(`/api/moderation/comments?${sp.toString()}`);
      const next = (data.items || []).map(mapApiToUI);

      if (reset) {
        setItems(next);
        setNextOffset(next.length);
      } else {
        setItems(prev => [...prev, ...next]);
        setNextOffset(o => o + next.length);
      }
      setTotal(Number(data.total || 0));
    } catch (e: any) {
      setError(e.message || "Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => loadPage(true), 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, source]);

  /* === Исключаем whitelisted из проблемных === */
  const flaggedCount = useMemo(
    () => items.reduce((a, it) => {
      // Если в белом списке - не считаем проблемным
      if (it.whitelisted) return a;
      return a + ((it.reports > 0 || it.hidden || banEngine.hasBanned(it.body)) ? 1 : 0);
    }, 0),
    [items, banEngine]
  );

  const filtered = useMemo(() => {
    const base = !searchQuery
      ? items
      : items.filter(c => `${c.body}`.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return onlyFlagged
      ? base.filter(c => {
          // Исключаем комментарии из белого списка
          if (c.whitelisted) return false;
          return c.reports > 0 || c.hidden || banEngine.hasBanned(c.body);
        })
      : base;
  }, [items, searchQuery, onlyFlagged, banEngine]);

  async function actWhitelist(id: string, src: UIComment["source"]) {
    setBusyId(id);
    try {
      await fetchJson<{ ok: true }>(`/api/moderation/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "whitelist", id, source: src }),
      });
      setItems(prev => prev.map(c => 
        c.id === id 
          ? { 
              ...c, 
              whitelisted: true, 
              reports: 0, 
              hidden: false,
              raw: { ...c.raw, whitelisted: true, reports_count: 0, is_hidden: false }
            } 
          : c
      ));
    } catch (e: any) {
      alert(`Ошибка: ${e.message}`);
    } finally {
      setBusyId(null);
    }
  }

  async function actApprove(id: string, src: UIComment["source"]) {
    setBusyId(id);
    try {
      await fetchJson<{ ok: true }>(`/api/moderation/comments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", id, source: src }),
      });
      setItems(prev => prev.map(c => c.id === id ? { ...c, reports: 0, hidden: false, raw: { ...c.raw, reports_count: 0, is_hidden: false } } : c));
    } catch (e: any) { alert(`Ошибка: ${e.message}`); }
    finally { setBusyId(null); }
  }

  async function actDelete(id: string, src: UIComment["source"]) {
    setBusyId(id);
    try {
      await fetchJson<{ ok: true }>(`/api/moderation/comments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id, source: src }),
      });
      setItems(prev => prev.filter(c => c.id !== id));
    } catch (e: any) { alert(`Ошибка: ${e.message}`); }
    finally { setBusyId(null); }
  }

  async function openReports(c: UIComment) {
    setRepFor(c);
    setRepOpen(true);
    setRepLoading(true);
    setRepError(null);
    try {
      const sp = new URLSearchParams({ source: c.source, id: c.id, limit: "100", offset: "0" });
      const data = await fetchJson<{ ok: true; items: ReportItem[]; total: number }>(`/api/moderation/comments/reports?${sp.toString()}`);
      setRepItems(data.items || []);
    } catch (e: any) {
      setRepError(e.message || "Ошибка загрузки жалоб");
    } finally {
      setRepLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className={`text-3xl font-bold ${textClass} mb-2`}>Модерация комментариев</h1>
        <p className={`${mutedText}`}>Запрещённые фрагменты подсвечены. Можно одобрить (сброс жалоб) или удалить.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
        {[{ label: "Всего", value: total }, { label: "Требуют внимания", value: flaggedCount }].map((s) => (
          <div key={s.label} className={`p-4 ${cardBg}`}>
            <div className={`text-2xl font-bold ${textClass}`}>{s.value}</div>
            <div className={`text-sm ${mutedText}`}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className={`p-4 ${cardBg}`}>
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
          <div className="flex-1 relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${mutedText}`} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по тексту..."
              className={`${inputClass} pl-10`}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className={`text-sm ${mutedText}`}>Источник:</label>
            <select
              value={source}
              onChange={(e) => { setSource(e.target.value as any); setNextOffset(0); }}
              className={`rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#0f1115] border border-black/10 dark:border-white/10 ${textClass}`}
            >
              <option value="all">Все</option>
              <option value="manga">Тайтлы</option>
              <option value="page">Страницы</option>
              <option value="post">Посты</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <Filter className={`w-5 h-5 ${mutedText}`} />
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} />
              Только проблемные
            </label>
            <button onClick={() => loadPage(true)} className={`${btnNeutral} px-3 py-2 text-sm ${textClass}`} title="Обновить">
              <RefreshCw className="h-4 w-4" /> Обновить
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className={`rounded-xl border p-3 ${theme === "light" ? "bg-red-50 border-red-200 text-red-800" : "bg-red-500/10 border-red-500/30 text-red-100"}`}>
          <AlertTriangle className="inline h-4 w-4 mr-2" /> {error}
        </div>
      )}

      <div className="grid gap-4">
        {filtered.length === 0 && !loading && (
          <div className={`p-8 text-center ${cardBg}`}>
            <MessageSquare className="mx-auto h-12 w-12 mb-2 opacity-50" />
            <p className={`${mutedText}`}>Нет комментариев по текущим фильтрам</p>
          </div>
        )}

        {filtered.map((c) => {
          const targetUrl = makeTargetUrl(c.source, c.target_id);
          const authorUrl = makeAuthorUrl(c.author_id);
          const isBanned = banEngine.hasBanned(c.body);
          const violations = (c.reports > 0 ? 1 : 0) + (c.hidden ? 1 : 0) + (isBanned ? 1 : 0);
          const isProblematic = !c.whitelisted && violations > 0;

          return (
            <div key={`${c.created_at}-${c.id}`} className={`p-4 ${cardBg}`}>
              {/* ДВЕ КОЛОНКИ: контент (с прокруткой) + кнопки */}
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4">
                {/* левая колонка */}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {/* Badge белого списка */}
                    {c.whitelisted && (
                      <span className="inline-flex items-center gap-1 text-xs rounded-full border border-green-400/60 px-2 py-0.5 text-green-700 dark:text-green-300">
                        <CheckCircle2 className="h-3 w-3" />
                        В белом списке
                      </span>
                    )}

                    {/* Показываем только если НЕ в whitelist */}
                    {!c.whitelisted && violations > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs rounded-full border border-red-400/60 px-2 py-0.5 text-red-700 dark:text-red-300">
                        <ShieldAlert className="h-3 w-3" />
                        {c.hidden ? "Скрыт" : "Подозрительный"}
                      </span>
                    )}

                    {!c.whitelisted && isBanned && (
                      <span className="inline-flex items-center gap-1 text-xs rounded-full border border-yellow-500/60 px-2 py-0.5 text-yellow-700 dark:text-yellow-300">
                        бан-лист
                      </span>
                    )}

                    {c.reports > 0 && (
                      <button
                        onClick={() => openReports(c)}
                        className="text-xs rounded-full border border-yellow-400/60 px-2 py-0.5 text-yellow-700 dark:text-yellow-300 underline decoration-dotted"
                        title="Открыть жалобы"
                      >
                        Жалоб: {c.reports}
                      </button>
                    )}

                    <span className={`text-xs ${mutedText}`}>{new Date(c.created_at).toLocaleString("ru-RU")}</span>
                    <span className={`text-xs ${mutedText}`}>·</span>

                    {targetUrl ? (
                      <a href={targetUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline inline-flex items-center gap-1" title="Открыть объект">
                        {c.source === "manga" ? "Тайтл" : c.source === "page" ? "Страница" : "Пост"}{" "}
                        {c.target_title ? `«${c.target_title}»` : `#${c.target_id}`}
                        <ExternalLink className="w-3 h-3 opacity-70" />
                      </a>
                    ) : (
                      <span className={`text-xs ${mutedText}`}>{c.source === "manga" ? "Тайтл" : c.source === "page" ? "Страница" : "Пост"} #?</span>
                    )}

                    {(c.author_id || c.author_name) && (
                      <>
                        <span className={`text-xs ${mutedText}`}>·</span>
                        {authorUrl ? (
                          <a href={authorUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline inline-flex items-center gap-1" title="Открыть профиль">
                            <UserRound className="w-3 h-3 opacity-70" />
                            {c.author_name || c.author_id}
                            <ExternalLink className="w-3 h-3 opacity-70" />
                          </a>
                        ) : (
                          <span className={`text-xs ${mutedText}`}><UserRound className="inline w-3 h-3 mr-1 opacity-70" />{c.author_name || c.author_id}</span>
                        )}
                      </>
                    )}
                  </div>

                  {/* ТЕКСТ */}
                  <div
                    className={`text-sm ${textClass} whitespace-pre-wrap break-words [overflow-wrap:anywhere] max-h-48 overflow-auto pr-2 pb-0.5`}
                    dangerouslySetInnerHTML={banEngine.highlight(c.body)}
                  />
                </div>

                {/* правая узкая колонка — кнопки */}
                <div className="flex flex-col gap-2 shrink-0">
                  {/* Кнопка "В белый список" - показываем если есть проблемы и НЕ в whitelist */}
                  {!c.whitelisted && isProblematic && (
                    <button
                      onClick={() => actWhitelist(c.id, c.source)}
                      disabled={busyId === c.id}
                      className={`${btnNeutral} px-2 py-1 text-xs ${textClass} disabled:opacity-50`}
                      title="Занести в белый список (больше не будет помечаться)"
                    >
                      {busyId === c.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      В белый список
                    </button>
                  )}

                  {/* Кнопка удаления */}
                  <button
                    onClick={() => actDelete(c.id, c.source)}
                    disabled={busyId === c.id}
                    className={`${btnNeutral} px-2 py-1 text-xs text-red-600 dark:text-red-400 disabled:opacity-50`}
                    title="Удалить"
                  >
                    {busyId === c.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Удалить
                  </button>

                  {c.hidden && !c.whitelisted && (
                    <div className="flex items-center gap-1 text-[11px] opacity-70">
                      <EyeOff className="h-3.5 w-3.5" /> скрыт автоматически
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {hasMore && (
          <div className="flex justify-center">
            <button onClick={() => loadPage(false)} className={`${btnNeutral} px-4 py-2 ${textClass}`}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Загрузить ещё"}
            </button>
          </div>
        )}
      </div>

      {/* Модалка жалоб */}
      {repOpen && (
        <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={() => setRepOpen(false)}>
          <div className="w-full max-w-2xl rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#0f1115]" onMouseDown={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
              <div className="font-semibold text-sm">
                Жалобы · {repFor ? repFor.target_title || `#${repFor.target_id}` : ""}
              </div>
              <button className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10" onClick={() => setRepOpen(false)} aria-label="Закрыть">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 max-h-[70vh] overflow-auto space-y-3">
              {repLoading && <div className={`${mutedText}`}>Загрузка…</div>}
              {repError && <div className="text-red-500 text-sm">{repError}</div>}
              {!repLoading && !repError && repItems.length === 0 && <div className={`${mutedText} text-sm`}>Жалоб нет</div>}

              {repItems.map((r) => (
                <div key={r.id} className="rounded-lg border border-black/10 dark:border-white/10 p-3">
                  <div className="text-xs flex flex-wrap items-center gap-2 mb-1">
                    <span className="rounded px-1.5 py-0.5 border border-yellow-500/50 text-yellow-700 dark:text-yellow-300">{r.reason}</span>
                    <span className={`${mutedText}`}>{r.created_at ? new Date(r.created_at).toLocaleString("ru-RU") : ""}</span>
                    {r.user_name && (<><span className={`${mutedText}`}>·</span><span className="text-xs">{r.user_name}</span></>)}
                    <span className={`${mutedText}`}>·</span>
                    <span className="text-xs">{r.status === "open" ? "открыта" : "закрыта"}</span>
                  </div>
                  {r.details && <div className="text-sm whitespace-pre-wrap">{r.details}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}