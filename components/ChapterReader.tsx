// components/ChapterReader.tsx
'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import ChapterLikeButton from '@/components/ChapterLikeButton';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  CornerDownRight,
  X,
  Heart,
  Trash2,
  Pencil,
  Pin,
  PinOff,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

/* =================== Types =================== */
type Page = {
  id: number;
  chapter_id: number;
  index: number;
  url: string;
  width?: number | null;
  height?: number | null;
  volume_index?: number | null;
};

type ChapterMeta = {
  id?: number | string | null;
  manga_id?: number | string | null;
  chapter_number?: number | string | null;
  vol?: number | string | null;
  title?: string | null;
};

type BaseReaderProps = { forceDark?: boolean };

type Props =
  | (BaseReaderProps & {
      chapterId: number | string;
      mangaId?: never; vol?: never; chapter?: never; page?: never;
    })
  | (BaseReaderProps & {
      chapterId?: never;
      mangaId: number | string;
      vol: number | string | 'none';
      chapter: number | string;
      page?: number | string;
    });

type PageComment = {
  id: string;
  page_id: number;
  chapter_id: number;
  user_id: string | null;
  created_at: string;
  content: string;
  parent_id?: string | null;
  is_team_comment?: boolean | null;
  team_id?: number | null;
  is_pinned?: boolean | null;
  likes_count?: number | null;
  is_edited?: boolean | null;
  edited_at?: string | null;
};

type Profile = { username?: string | null; avatar_url?: string | null };
type Team = { name?: string | null; avatar_url?: string | null };
type TeamInfo = { id?: number | null; name?: string | null; slug?: string | null; avatar_url?: string | null; verified?: boolean | null };
type SortMode = 'new' | 'old' | 'top';

/* =================== Helpers =================== */
function sanitize(input: string) {
  let html = (input || '').replace(/&nbsp;/gi, ' ');
  html = html.replace(/<strike\b[^>]*>/gi, '<s>').replace(/<\/strike>/gi, '</s>');
  const allow = ['b','i','u','s','del','strong','em','br'].join('|');
  html = html.replace(new RegExp(String.raw`<(?!\/?(?:${allow})\b)[^>]*>`, 'gi'), '');
  html = html.replace(new RegExp(String.raw`<(?:${allow})>\s*<\/(?:${allow})>`, 'gi'), '');
  html = html.replace(/(?:<br\s*\/?>\s*){3,}/gi, '<br><br>');
  return html.trim();
}
function pickUserId(j: any): string | null {
  const cand = j?.userId ?? j?.user_id ?? j?.id ?? j?.user?.id ?? j?.session?.user?.id ?? null;
  return cand != null ? String(cand) : null;
}

/* =================== Component =================== */
export default function ChapterReader(props: Props) {
  const pathname = usePathname();
  const router = useRouter();

  /* ---------- Anchor to scroll top of reader ---------- */
  const topRef = useRef<HTMLDivElement | null>(null);
  const scrollToReaderTop = useCallback(() => {
    // Скроллим к началу блока ридера (плавно)
    if (topRef.current) {
      topRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  /* ---------- Params ---------- */
  const byId = 'chapterId' in props && props.chapterId !== undefined;
  const chapterId = byId ? String((props as any).chapterId) : null;
  const mangaId   = !byId ? String((props as any).mangaId) : null;
  const vol       = !byId ? String((props as any).vol) : null;
  const chapter   = !byId ? String((props as any).chapter) : null;
  const pageParam = !byId ? String((props as any).page ?? '1') : '1';

  const pagesUrl = useMemo(() => {
    if (byId && chapterId) return `/api/reader/chapter/${encodeURIComponent(chapterId)}/pages`;
    if (!byId && mangaId && vol != null && chapter != null)
      return `/api/reader/${encodeURIComponent(mangaId)}/volume/${encodeURIComponent(vol)}/chapter/${encodeURIComponent(chapter)}/pages`;
    return '';
  }, [byId, chapterId, mangaId, vol, chapter]);

  /* ---------- State ---------- */
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<ChapterMeta>({});
  const [nextHref, setNextHref] = useState<string | null>(null);
  const [index, setIndex] = useState(0);

  /* ---------- Auth ---------- */
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' });
        const j = r.ok ? await r.json() : null;
        setUserId(pickUserId(j));
      } catch { setUserId(null); }
    })();
  }, []);

  /* ---------- Initial page ---------- */
  useEffect(() => {
    const n = Math.max(1, Number(pageParam || 1)) - 1;
    setIndex(n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageParam]);

  /* ---------- Load pages ---------- */
  useEffect(() => {
    if (!pagesUrl) return;
    let cancel = false;
    setLoading(true); setError(null);

    fetch(pagesUrl, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j?.error || `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((j) => {
        if (cancel) return;
        const arr: Page[] = (Array.isArray(j?.pages) ? j.pages : Array.isArray(j?.items) ? j.items : [])
          .map((p: any) => ({
            id: Number(p.id),
            chapter_id: Number(p.chapter_id),
            index: Number(p.index ?? p.page_index ?? p.page_number ?? 0),
            url: String(p.url ?? p.image_url ?? ''),
            width: p.width ?? null,
            height: p.height ?? null,
            volume_index: p.volume_index == null ? null : Number(p.volume_index),
          }))
          .sort((a: Page, b: Page) => a.index - b.index || a.id - b.id);

        const start = Math.min(Math.max(0, Math.max(1, Number(pageParam || 1)) - 1), Math.max(0, arr.length - 1));
        setPages(arr);
        setIndex(start);
      })
      .catch((e: any) => !cancel && setError(e.message || 'Ошибка загрузки'))
      .finally(() => !cancel && setLoading(false));

    return () => { cancel = true; };
  }, [pagesUrl, pageParam]);

  /* ---------- Update /p/N in url ---------- */
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!pathname) return;
    if (!didMountRef.current) { didMountRef.current = true; return; }
    const base = pathname.replace(/\/p\/\d+\/?$/i, '');
    const next = `${base}/p/${Math.max(1, index + 1)}`;
    if (next !== window.location.pathname) window.history.replaceState(null, '', next);
  }, [index, pathname]);

  /* ---------- Preload neighbors ---------- */
  useEffect(() => {
    const nextUrl = pages[index + 1]?.url;
    const prevUrl = pages[index - 1]?.url;
    [nextUrl, prevUrl].filter(Boolean).forEach((src) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = src as string;
    });
  }, [index, pages]);

  /* ---------- Meta / next chapter ---------- */
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        if (byId && chapterId) {
          const r = await fetch(`/api/chapters/${chapterId}`, { cache: 'no-store' });
          const j = await r.json().catch(() => ({}));
          const ch: ChapterMeta = j?.item ?? {};
          if (!cancel) setMeta(ch);

          if (ch?.manga_id != null && ch?.chapter_number != null) {
            const n = await fetch(
              `/api/manga/${ch.manga_id}/chapters/next?after=${encodeURIComponent(String(ch.chapter_number))}`,
              { cache: 'no-store' },
            );
            const nj = await n.json().catch(() => ({}));
            if (!cancel && nj?.item?.id) setNextHref(`/manga/${ch.manga_id}/chapter/${nj.item.id}`);
            else if (!cancel) setNextHref(null);
          }
          return;
        }

        if (!byId && mangaId && vol != null && chapter != null) {
          if (!cancel) setMeta({ manga_id: mangaId, vol, chapter_number: chapter });

          const r = await fetch(`/api/reader/${mangaId}/volume/${vol}/chapters`, { cache: 'no-store' });
          const j = await r.json().catch(() => ({}));
          const list: { chapter: string }[] = Array.isArray(j?.items) ? j.items : [];

          const current = String(chapter);
          const idx = list.findIndex((x) => String(x.chapter) === current);
          if (!cancel) {
            if (idx >= 0 && idx + 1 < list.length) {
              const n = String(list[idx + 1].chapter);
              setNextHref(`/manga/${mangaId}/v/${vol}/c/${n}/p/1`);
            } else setNextHref(null);
          }
        }
      } catch {}
    })();
    return () => { cancel = true; };
  }, [byId, chapterId, mangaId, vol, chapter]);

  /* ---------- Translator teams (badge) ---------- */
  const [chapterTeams, setChapterTeams] = useState<TeamInfo[]>([]);
  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        if (byId && chapterId) {
          const r1 = await fetch(`/api/chapters/${chapterId}/teams`, { cache: 'no-store' });
          if (r1.ok) {
            const j1 = await r1.json().catch(() => ({}));
            if (!abort && (Array.isArray(j1?.items) || Array.isArray(j1?.teams))) {
              setChapterTeams((j1.items ?? j1.teams) as TeamInfo[]);
              return;
            }
          }
        }
        const mid = (meta?.manga_id ?? mangaId) as string | null;
        if (!mid) return;
        const r2 = await fetch(`/api/manga/${mid}/teams`, { cache: 'no-store' });
        const j2 = await r2.json().catch(() => ({}));
        if (!abort) setChapterTeams((j2?.items ?? j2?.teams ?? []) as TeamInfo[]);
      } catch {}
    })();
    return () => { abort = true; };
  }, [byId, chapterId, mangaId, meta?.manga_id]);

  /* ---------- Comments ---------- */
  const [pageComments, setPageComments] = useState<PageComment[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [teams, setTeams] = useState<Record<number, Team>>({});
  const [likedByMe, setLikedByMe] = useState<Record<string, boolean>>({});
  const [likesCount, setLikesCount] = useState<Record<string, number>>({});

  const loadPageComments = useCallback(async (page: Page, signal?: AbortSignal) => {
    const url = `/api/reader/pages/${page.id}/comments${userId ? `?user=${encodeURIComponent(userId)}` : ''}`;
    const r = await fetch(url, { cache: 'no-store', signal, credentials: 'include' });
    const j = await r.json().catch(() => ({}));

    const comments: PageComment[] = j?.items ?? [];
    setPageComments(comments);
    setProfiles(j?.users ?? {});
    setTeams(j?.teams ?? {});

    const likes: Record<string, number> = {};
    comments.forEach((c) => { likes[c.id] = c.likes_count ?? 0; });
    setLikesCount(likes);
    setLikedByMe(j?.likedByMe ?? {});
  }, [userId]);

  const chapterIdForLike = useMemo(() => {
    if (byId && chapterId) return Number(chapterId);
    return Number(pages[0]?.chapter_id || 0);
  }, [byId, chapterId, pages]);

  // Включаем «чёрный ридер» (фикс цвета на время монтирования)
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.classList.add('reader-force-dark');
    body.classList.add('reader-force-dark');
    return () => {
      html.classList.remove('reader-force-dark');
      body.classList.remove('reader-force-dark');
    };
  }, []);

  useEffect(() => {
    const p = pages[index];
    if (!p) { setPageComments([]); return; }
    const ctrl = new AbortController();
    loadPageComments(p, ctrl.signal).catch(() => {});
    return () => ctrl.abort();
  }, [pages, index, loadPageComments]);

  /* ---------- Editor ---------- */
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string } | null>(null);
  const [asTeam, setAsTeam] = useState(false);
  const [pinOnSend, setPinOnSend] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);

  const sendComment = async () => {
    if (!userId) return alert('Войдите, чтобы комментировать');
    const page = pages[index];
    if (!page) return;

    const html = sanitize(editorRef.current?.innerHTML ?? '');
    const plain = editorRef.current?.textContent?.replace(/\u00a0/g, ' ').trim() ?? '';
    if (!plain) return;

    setSending(true);
    try {
      const r = await fetch(`/api/reader/pages/${page.id}/comments`, {
        method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user_id: userId, content: html, parent_id: replyTo?.id ?? null, as_team: asTeam, pin: pinOnSend }),
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || 'Не удалось отправить');

      if (editorRef.current) editorRef.current.innerHTML = '';
      setIsEmpty(true); setReplyTo(null); setAsTeam(false); setPinOnSend(false);
      await loadPageComments(page);
    } catch (e: any) {
      alert(e?.message ?? 'Ошибка отправки');
    } finally { setSending(false); }
  };

  /* ---------- Likes ---------- */
  async function toggleLike(id: string) {
    if (!userId) return alert('Войдите');
    const liked = !!likedByMe[id];
    const url = `/api/reader/comments/${encodeURIComponent(id)}/like`;
    try {
      if (liked) {
        await fetch(url, { method: 'DELETE', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user_id: userId }) });
        setLikedByMe((m) => ({ ...m, [id]: false }));
        setLikesCount((m) => ({ ...m, [id]: Math.max(0, (m[id] ?? 1) - 1) }));
      } else {
        await fetch(url, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user_id: userId }) });
        setLikedByMe((m) => ({ ...m, [id]: true }));
        setLikesCount((m) => ({ ...m, [id]: (m[id] ?? 0) + 1 }));
      }
    } catch (e: any) { alert(e?.message ?? 'Не удалось изменить лайк'); }
  }

  /* ---------- Edit/Delete ---------- */
  const [editingId, setEditingId] = useState<string | null>(null);
  const editRef = useRef<HTMLDivElement | null>(null);
  function startEdit(id: string, html: string) {
    setEditingId(id);
    setTimeout(() => { if (editRef.current) editRef.current.innerHTML = html; }, 0);
  }
  async function saveEdit(id: string) {
    if (!userId) return;
    const html = sanitize(editRef.current?.innerHTML ?? '');
    if (!html) return;
    const r = await fetch(`/api/reader/comments/${encodeURIComponent(id)}`, {
      method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user_id: userId, content: html }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.ok) return alert(j?.error || 'Не удалось сохранить');
    setPageComments((prev) => prev.map((c) => (c.id === id ? { ...c, content: html, is_edited: true } : c)));
    setEditingId(null);
  }
  async function deleteComment(id: string) {
    if (!userId) return;
    if (!confirm('Удалить комментарий?')) return;
    const r = await fetch(`/api/reader/comments/${encodeURIComponent(id)}`, {
      method: 'DELETE', credentials: 'include', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.ok) return alert(j?.error || 'Не удалось удалить');
    setPageComments((prev) => prev.filter((c) => c.id !== id && c.parent_id !== id));
  }

  /* ---------- Page picker hooks ---------- */
  const [pickerOpen, setPickerOpen] = useState(false);
  const pagePickerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!pickerOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!pagePickerRef.current) return;
      if (!pagePickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setPickerOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [pickerOpen]);

  useEffect(() => {
    if (!pickerOpen) return;
    const el = document.querySelector('[data-current-page="true"]') as HTMLElement | null;
    if (el) el.scrollIntoView({ block: 'center' });
  }, [pickerOpen]);

  /* ---------- Navigation ---------- */
  const prevPage = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(() => {
    setIndex((i) => {
      if (i + 1 < pages.length) return i + 1;
      if (nextHref) router.push(nextHref);
      else {
        const mid = (meta?.manga_id ?? mangaId) as string | null;
        router.push(mid ? `/manga/${mid}` : '/');
      }
      return i;
    });
  }, [pages.length, nextHref, router, meta?.manga_id, mangaId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prevPage();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prevPage, goNext]);

  /* ---------- Sort mode ---------- */
  const [sortMode, setSortMode] = useState<SortMode>('new');

  /* ---------- Early returns ---------- */
  if (loading) return <div className="p-6 text-slate-400">Загрузка главы…</div>;
  if (error) return <div className="p-6 text-red-400">Ошибка: {error}</div>;
  if (!pages.length) return <div className="p-6 text-slate-400">Страниц нет</div>;

  /* ---------- Derived ---------- */
  const current = pages[index];
  const pageToShow = index + 1;

  /* ---------- Styles (Reader — фиксированный тёмный) ---------- */
  const pageSurface = 'bg-black text-white border border-black';
  const commentSurface = 'bg-[#1f1f1f] text-white border border-[#1a1a1a]';
  const softOnComment = 'bg-[#262626] border-[#2f2f2f]';
  const pillBtn =
    'px-3 py-1.5 rounded-full bg-[#2a2a2a] border border-[#3a3a3a] shadow-sm hover:bg-[#333333] text-[#e5e7eb] focus-visible:outline-none focus-visible:ring-2 ring-white/10';
  const toolbarBtn =
    'px-3 py-1 rounded-md bg-[#2a2a2a] border border-[#3a3a3a] hover:bg-[#333333] text-[#e5e7eb] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 ring-white/10';
  const editorBox = (enabled: boolean) =>
    `min-h-[64px] rounded-lg p-3 outline-none bg-[#262626] text-[#e5e7eb] ${enabled ? '' : 'opacity-60'} focus-visible:ring-2 ring-white/10`;
  const sendBtn =
    'px-4 py-2 rounded-lg bg-[#2a2a2a] hover:bg-[#333333] text-[#e5e7eb] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 ring-white/20';
  const listItem =
    'w-full rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4 text-[#e5e7eb]';
  const replyBox = 'ml-6 mt-3 border-l border-[#2a2a2a] pl-4';

  /* ---------- Render ---------- */
  return (
    <>
      <div className="mx-auto max-w-5xl p-3 sm:p-6 space-y-6">
        {/* якорь для скролла к началу */}
        <div ref={topRef} />

        {/* Верхняя панель — только «Следующая» */}
        <div className="mb-1 flex items-center justify-end">
          {nextHref && (
            <Link
              href={nextHref}
              className="px-3 py-2 inline-flex items-center gap-1 bg-slate-700 hover:bg-slate-600 rounded-lg text-white"
            >
              Следующая <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>

        {/* Картинка страницы — ЧЁРНАЯ ПОДЛОЖКА */}
        <div className={`relative overflow-hidden rounded-xl ${pageSurface}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.url}
            alt={`page-${index + 1}`}
            className="w-full h-auto select-none"
            draggable={false}
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
          <button onClick={prevPage} className="group absolute inset-y-0 left-0 w-1/2 focus:outline-none" aria-label="Prev" />
          <button onClick={goNext} className="group absolute inset-y-0 right-0 w-1/2 focus:outline-none" aria-label="Next" />
        </div>

        {/* Пейджер */}
        <div className="flex items-center justify-center">
          <div className="relative" ref={pagePickerRef}>
            <button
              onClick={() => setPickerOpen((v) => !v)}
              className={pillBtn + ' inline-flex items-center gap-1'}
              aria-expanded={pickerOpen}
            >
              Стр. {pageToShow}/{pages.length}
              <ChevronDown className="w-4 h-4 opacity-70" />
            </button>

            {pickerOpen && (
              <div className="absolute left-1/2 -translate-x-1/2 z-50 mt-2 w-[22rem] sm:w-[24rem] rounded-2xl border border-[#2a2a2a] shadow-2xl backdrop-blur bg-[#1f1f1f]/95">
                {/* Только сетка страниц */}
                <div className="max-h-72 overflow-y-auto px-3 py-3">
                  <div className="grid grid-cols-10 gap-1">
                    {pages.map((_, i) => {
                      const active = i === index;
                      return (
                        <button
                          key={i}
                          data-current-page={active ? 'true' : undefined}
                          onClick={() => {
                            setIndex(i);
                            setPickerOpen(false);
                            scrollToReaderTop();
                          }}
                          className={`h-9 rounded-lg text-sm tabular-nums transition
                            ${active
                              ? 'bg-white text-black shadow-inner'
                              : 'bg-[#2a2a2a] border border-[#3a3a3a] hover:bg-[#333333] text-[#e5e7eb]'
                            }`}
                          title={`Стр. ${i + 1}`}
                        >
                          {i + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Линия под пейджером / блок с бэджом команды и лайком */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {chapterTeams.length > 0 ? (
              <Link
                href={`/team/${chapterTeams[0]!.slug ?? chapterTeams[0]!.id}`}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 bg-white/5 border-white/10"
                title="Команда перевода"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {chapterTeams[0]?.avatar_url ? (
                  <img src={chapterTeams[0]!.avatar_url!} alt="" className="h-6 w-6 rounded-full object-cover" />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-white/10" />
                )}
                <span className="text-sm text-white">
                  Перевод: <b>{chapterTeams[0]!.name ?? 'Команда'}</b>
                </span>
                {chapterTeams.length > 1 && <span className="text-xs text-white/70">+{chapterTeams.length - 1}</span>}
              </Link>
            ) : (
              <div
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm bg-white/5 border-white/10 text-white"
                title="Команда перевода"
              >
                <div className="h-6 w-6 rounded-full bg-white/10" />
                Перевод: неизвестно
              </div>
            )}
          </div>

          {/* Лайк — теперь такой же «пилл», как слева */}
          {chapterIdForLike ? (
            <div
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 bg-white/5 border-white/10 text-white"
              data-like-scope
            >
              <ChapterLikeButton chapterId={chapterIdForLike} />
            </div>
          ) : null}
        </div>

        {/* ===== Комментарии: full-bleed фон ===== */}
        <section className="relative">
          <div className="relative left-1/2 -translate-x-1/2 w-screen bg-[#1f1f1f]">
            <div className="mx-auto max-w-5xl px-3 sm:px-6 py-6">
              <div className={`w-full rounded-xl p-4 ${commentSurface}`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => document.execCommand('bold')} className={toolbarBtn} title="Жирный"><Bold className="w-4 h-4" /></button>
                    <button onClick={() => document.execCommand('italic')} className={toolbarBtn} title="Курсив"><Italic className="w-4 h-4" /></button>
                    <button onClick={() => document.execCommand('underline')} className={toolbarBtn} title="Подчеркнуть"><Underline className="w-4 h-4" /></button>
                    <button
                      onClick={() => {
                        const didWork = document.execCommand('strikeThrough');
                        if (!didWork) {
                          try { document.execCommand('strikethrough'); } catch {}
                        }
                      }}
                      className={toolbarBtn}
                      title="Зачеркнуть"
                    >
                      <Strikethrough className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="inline-flex items-center gap-1 rounded-lg border border-[#2a2a2a] px-1 py-0.5 text-sm bg-[#2a2a2a]">
                    <button onClick={() => setSortMode('new')} className={`px-2 py-1 rounded ${'new'===sortMode ? 'bg-[#3a3a3a]' : 'hover:bg-[#333333]'}`}>Новые</button>
                    <button onClick={() => setSortMode('old')} className={`px-2 py-1 rounded ${'old'===sortMode ? 'bg-[#3a3a3a]' : 'hover:bg-[#333333]'}`}>Старые</button>
                    <button onClick={() => setSortMode('top')} className={`px-2 py-1 rounded ${'top'===sortMode ? 'bg-[#3a3a3a]' : 'hover:bg-[#333333]'}`}>Популярные</button>
                  </div>
                </div>

                {!userId && <div className="mb-2 text-sm text-[#9ca3af]">Войдите в систему, чтобы оставлять комментарии</div>}

                {replyTo && (
                  <div className="mb-2 inline-flex items-center gap-2 text-sm text-[#9ca3af]">
                    <CornerDownRight className="w-4 h-4" /> Ответ на #{replyTo.id.slice(0, 6)}…
                    <button onClick={() => setReplyTo(null)} className="inline-flex items-center gap-1 text-xs opacity-80 hover:opacity-100"><X className="w-3 h-3" /> отменить</button>
                  </div>
                )}

                <div className={`relative rounded-lg border ${softOnComment}`}>
                  {isEmpty && (
                    <span className="pointer-events-none absolute left-3 top-3 text-sm text-[#9ca3af] opacity-60">
                      {userId ? 'Напишите комментарий…' : 'Войдите, чтобы комментировать'}
                    </span>
                  )}
                  <div
                    ref={editorRef}
                    contentEditable={!!userId}
                    suppressContentEditableWarning
                    className={editorBox(!!userId)}
                    onInput={() => {
                      const txt = editorRef.current?.textContent?.replace(/\u00a0/g, ' ').trim() ?? '';
                      setIsEmpty(txt.length === 0);
                    }}
                    onPaste={(e) => {
                      if (!userId) return;
                      e.preventDefault();
                      const text = (e.clipboardData || (window as any).clipboardData).getData('text/plain');
                      document.execCommand('insertText', false, text);
                    }}
                    onKeyDown={(e) => {
                      if (!userId) return;
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        void sendComment();
                      }
                    }}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <label className={`inline-flex items-center gap-2 ${userId ? '' : 'opacity-50'}`}>
                    <input type="checkbox" disabled={!userId} checked={asTeam} onChange={(e) => { setAsTeam(e.target.checked); if (!e.target.checked) setPinOnSend(false); }} />
                    <span>От команды</span>
                  </label>
                  <label className={`inline-flex items-center gap-2 ${userId && asTeam ? '' : 'opacity-50'}`}>
                    <input type="checkbox" disabled={!userId || !asTeam} checked={pinOnSend} onChange={(e) => setPinOnSend(e.target.checked)} />
                    <span>Закрепить</span>
                    {pinOnSend ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
                  </label>
                  <button onClick={sendComment} disabled={sending || !userId || isEmpty} className={sendBtn}>
                    {sending ? 'Отправка…' : replyTo ? 'Ответить' : 'Отправить'}
                  </button>
                </div>
              </div>

              {/* Список */}
              <div className="mt-4 space-y-4">
                {pageComments.filter(c => !c.parent_id).length === 0 && (
                  <div className="text-center text-sm text-[#9ca3af]">Пока нет комментариев к этой странице — будьте первым!</div>
                )}

                {(() => {
                  const roots = pageComments.filter((c) => !c.parent_id);
                  const childrenMap = pageComments.reduce<Record<string, PageComment[]>>((a, c) => {
                    if (c.parent_id) (a[c.parent_id] ||= []).push(c);
                    return a;
                  }, {});
                  const cmpNew = (a: PageComment, b: PageComment) => +new Date(b.created_at) - +new Date(a.created_at);
                  const cmpOld = (a: PageComment, b: PageComment) => +new Date(a.created_at) - +new Date(b.created_at);
                  const cmpTop = (a: PageComment, b: PageComment) => (likesCount[b.id] ?? 0) - (likesCount[a.id] ?? 0) || cmpNew(a, b);
                  const base = sortMode === 'new' ? cmpNew : sortMode === 'old' ? cmpOld : cmpTop;
                  const sortWithPinned = (fn: (a: PageComment, b: PageComment) => number) => (a: PageComment, b: PageComment) => {
                    const pa = a.is_pinned ? 1 : 0, pb = b.is_pinned ? 1 : 0;
                    return pb - pa || fn(a, b);
                  };
                  const sortFn = sortWithPinned(base);

                  const nameOf = (c: PageComment) => {
                    if (c.is_team_comment && c.team_id != null) return teams[c.team_id!]?.name ?? 'Команда';
                    return c.user_id ? profiles[c.user_id]?.username ?? 'Без имени' : 'Аноним';
                  };

                  return roots.sort(sortFn).map((c) => {
                    const replies = (childrenMap[c.id] ?? []).sort(sortFn);
                    const me = c.user_id === userId;

                    return (
                      <article
                        key={c.id}
                        className={`${listItem} ${c.is_pinned ? 'bg-[#23272e] border-[#39414f]' : ''}`}
                      >
                        <header className="flex items-center gap-3">
                          {c.is_team_comment && c.team_id != null && teams[c.team_id]?.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={teams[c.team_id]!.avatar_url!} alt="" className="w-10 h-10 rounded-full object-cover" />
                          ) : c.user_id && profiles[c.user_id]?.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={profiles[c.user_id]!.avatar_url!} alt="" className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-white/10" />
                          )}

                          <div className="text-sm font-semibold">{nameOf(c)}</div>
                          <div className="text-xs text-[#9ca3af]">• {new Date(c.created_at).toLocaleString('ru-RU', { hour12: false })}</div>

                          <div className="ml-auto inline-flex items-center gap-3">
                            {c.is_team_comment && c.is_pinned && (
                              <span className="text-xs opacity-90 inline-flex items-center gap-1">
                                <Pin className="w-5 h-5" /> Закреплено
                              </span>
                            )}
                            <button onClick={() => setReplyTo({ id: c.id })} className="inline-flex items-center gap-1 text-xs opacity-90 hover:opacity-100">
                              <CornerDownRight className="w-5 h-5" /> Ответить
                            </button>
                            <button onClick={() => toggleLike(c.id)} className="inline-flex items-center gap-1 text-xs opacity-90 hover:opacity-100">
                              <Heart className={`w-3.5 h-3.5 ${likedByMe[c.id] ? 'fill-current' : ''}`} />
                              <span className="tabular-nums">{likesCount[c.id] ?? 0}</span>
                            </button>
                            {me && (
                              <>
                                <button onClick={() => startEdit(c.id, c.content)} className="inline-flex items-center gap-1 text-xs opacity-90 hover:opacity-100">
                                  <Pencil className="w-3.5 h-3.5" /> Редактировать
                                </button>
                                <button onClick={() => deleteComment(c.id)} className="inline-flex items-center gap-1 text-xs opacity-90 hover:opacity-100">
                                  <Trash2 className="w-3.5 h-3.5" /> Удалить
                                </button>
                              </>
                            )}
                          </div>
                        </header>

                        {editingId === c.id ? (
                          <div className="mt-2">
                            <div ref={editRef} contentEditable suppressContentEditableWarning className={editorBox(true)} />
                            <div className="mt-2 flex gap-2 justify-end">
                              <button onClick={() => saveEdit(c.id)} className={sendBtn}>Сохранить</button>
                              <button onClick={() => { setEditingId(null); if (editRef.current) editRef.current.innerHTML = ''; }} className="px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5">
                                Отмена
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className="mt-2 text-[15px] leading-relaxed break-words prose prose-sm max-w-none text-[#e5e7eb]"
                            dangerouslySetInnerHTML={{ __html: c.content }}
                          />
                        )}

                        {replies.length > 0 && (
                          <div className={replyBox}>
                            <div className="space-y-3">
                              {replies.map((r) => {
                                const mine = r.user_id === userId;
                                return (
                                  <div
                                    key={r.id}
                                    className={`rounded-lg p-3 ${
                                      r.is_pinned ? 'bg-[#23272e] border border-[#39414f]' : 'bg-[#262626]'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="text-sm font-medium">{nameOf(r)}</div>
                                      <div className="text-[11px] text-[#9ca3af]">• {new Date(r.created_at).toLocaleString('ru-RU', { hour12: false })}</div>
                                      <div className="ml-auto inline-flex items-center gap-3">
                                        <button onClick={() => setReplyTo({ id: c.id })} className="inline-flex items-center gap-1 text-[11px] opacity-90 hover:opacity-100"><CornerDownRight className="w-3 h-3" /> Ответить</button>
                                        <button onClick={() => toggleLike(r.id)} className="inline-flex items-center gap-1 text-[11px] opacity-90 hover:opacity-100">
                                          <Heart className={`w-3 h-3 ${likedByMe[r.id] ? 'fill-current' : ''}`} />
                                          <span className="tabular-nums">{likesCount[r.id] ?? 0}</span>
                                        </button>
                                        {mine && (
                                          <>
                                            <button onClick={() => startEdit(r.id, r.content)} className="inline-flex items-center gap-1 text-[11px] opacity-90 hover:opacity-100"><Pencil className="w-3 х-3" /> Редактировать</button>
                                            <button onClick={() => deleteComment(r.id)} className="inline-flex items-center gap-1 text-[11px] opacity-90 hover:opacity-100"><Trash2 className="w-3 h-3" /> Удалить</button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    {editingId === r.id ? (
                                      <div className="mt-1">
                                        <div ref={editRef} contentEditable suppressContentEditableWarning className={editorBox(true)} />
                                        <div className="mt-2 flex gap-2 justify-end">
                                          <button onClick={() => saveEdit(r.id)} className={sendBtn}>Сохранить</button>
                                          <button onClick={() => { setEditingId(null); if (editRef.current) editRef.current.innerHTML = ''; }} className="px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5">Отмена</button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="mt-1 leading-relaxed break-words prose prose-sm max-w-none text-[#e5e7eb]" dangerouslySetInnerHTML={{ __html: r.content }} />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* --- Минимальные глобальные стили для лайк-кнопки внутри data-like-scope --- */}
      <style jsx global>{`
        [data-like-scope] { color: #ffffff !important; }
        [data-like-scope] svg { stroke: currentColor !important; }
        [data-like-scope] .fill-current { fill: currentColor !important; }
        [data-like-scope] button,
        [data-like-scope] .btn {
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
          color: inherit !important;
          padding: 0 !important;
        }
        [data-like-scope] button:hover,
        [data-like-scope] .btn:hover { filter: none !important; color: inherit !important; }
      `}</style>
    </>
  );
}
