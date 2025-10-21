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
  Bookmark,
  BookmarkCheck,
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
      mangaId: number | string;             // может быть "21-ichinoseke-no-taizai"
      vol: number | string | 'none';        // том из URL
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

// --- helpers для построения ссылок следующей главы ---
function isNoneLike(v: any) {
  const s = String(v ?? '').trim().toLowerCase();
  return s === '' || s === 'none' || s === 'null' || s === 'undefined';
}
function pickVolForUrl(nextVol: any, currentVolFromUrl: any) {
  const n = String(nextVol ?? '').trim();
  if (n && !isNoneLike(n)) return n;                 // у следующей главы есть явный том
  const c = String(currentVolFromUrl ?? '').trim();
  if (c && !isNoneLike(c)) return c;                 // иначе — берём текущий том из URL
  return 'none';                                     // крайний случай
}
function buildChapterUrl(midForUrl: string, volForUrl: string, ch: string | number, page = 1) {
  // Всегда оставляем сегмент тома /v/<vol>
  return `/title/${midForUrl}/v/${encodeURIComponent(volForUrl)}/c/${encodeURIComponent(ch)}/p/${page}`;
}
const numId = (idOrSlug: string) => (idOrSlug.match(/\d+/)?.[0] ?? idOrSlug);

/* =================== Component =================== */
export default function ChapterReader(props: Props) {
  const pathname = usePathname();
  const router = useRouter();

  /* ---------- Anchor to scroll top of reader ---------- */
  const topRef = useRef<HTMLDivElement | null>(null);
  const scrollToReaderTop = useCallback(() => {
    if (topRef.current) {
      topRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  /* ---------- Params ---------- */
  const byId = 'chapterId' in props && props.chapterId !== undefined;
  const chapterId = byId ? String((props as any).chapterId) : null;
  const mangaId   = !byId ? String((props as any).mangaId) : null; // slug или число
  const vol       = !byId ? String((props as any).vol) : null;     // том из URL
  const chapter   = !byId ? String((props as any).chapter) : null;
  const pageParam = !byId ? String((props as any).page ?? '1') : '1';

  // API всегда надёжнее дёргать по числовому id
  const mangaIdForApi = useMemo(() => (mangaId ? numId(String(mangaId)) : null), [mangaId]);

  const pagesUrl = useMemo(() => {
    if (byId && chapterId)
      return `/api/reader/chapter/${encodeURIComponent(chapterId)}/pages`;
    if (!byId && mangaIdForApi && vol != null && chapter != null)
      return `/api/reader/${encodeURIComponent(mangaIdForApi)}/volume/${encodeURIComponent(vol)}/chapters/${encodeURIComponent(chapter)}/pages`;
    return '';
  }, [byId, chapterId, mangaIdForApi, vol, chapter]);

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

    const pick = {
      vol: (o: any) =>
        o?.vol_number ?? o?.volume_number ?? o?.volume_index ?? o?.vol ?? o?.volume ?? null,
      ch: (o: any) =>
        o?.chapter_number ?? o?.chapter ?? o?.ch ?? o?.number ?? null,
    };

    const fetchJson = async (url: string) => {
      try {
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) return null;
        return await r.json();
      } catch {
        return null;
      }
    };

    // если у следующей главы нет тома в списке, пробуем взять его из /api/chapters/:id
    const resolveVolViaChapterId = async (chapterId: any) => {
      if (!chapterId) return null;
      const j = await fetchJson(`/api/chapters/${encodeURIComponent(chapterId)}`);
      const v = pick.vol(j?.item ?? null);
      return v == null ? null : String(v);
    };

    // Находит следующую главу ТОЛЬКО по номеру (игнорируем том), но в URL том сохраняем/уточняем.
    const findNextChapterFromList = async (
      midForApi: string,           // числовой id для API
      currentCh: string,           // номер текущей главы
      currentVolFromUrl: string,   // ТЕКУЩИЙ том из URL (например "4")
      midForUrl?: string           // что показывать в URL (slug "21-xxx" или просто "21")
    ) => {
      const j = await fetchJson(`/api/manga/${midForApi}/chapters?limit=500`);
      if (!j || !j.items) return null;

      const chapters = j.items
        .map((item: any) => {
          const rawVol = pick.vol(item);
          const ch = pick.ch(item);
          if (ch == null) return null;
          return {
            vol: rawVol == null ? null : String(rawVol),
            ch: String(ch),
            id: item.id,
          };
        })
        .filter(Boolean) as { vol: string | null; ch: string; id: any }[];

      if (!chapters.length) return null;

      // Сортируем только по номеру главы
      chapters.sort((a, b) => Number(a.ch) - Number(b.ch));

      const currentChNum = Number(currentCh);
      const currentIndex = chapters.findIndex((c) => Number(c.ch) === currentChNum);

      if (currentIndex >= 0 && currentIndex < chapters.length - 1) {
        const next = chapters[currentIndex + 1];

        // если у next.vol нет значения — дёрнем детальную инфу по id главы
        let nextVol = next.vol;
        if (nextVol == null || isNoneLike(nextVol)) {
          const v = await resolveVolViaChapterId(next.id);
          if (v != null && !isNoneLike(v)) nextVol = v;
        }

        const volForUrl = pickVolForUrl(nextVol, currentVolFromUrl);
        const midUrl = midForUrl ?? midForApi;
        return buildChapterUrl(midUrl, volForUrl, next.ch, 1);
      }
      return null;
    };

    (async () => {
      try {
        if (byId && chapterId) {
          // Загружаем метаданные текущей главы по id
          const r = await fetch(`/api/chapters/${encodeURIComponent(chapterId)}`, { cache: 'no-store' });
          const j = await r.json().catch(() => ({}));
          const chMeta: ChapterMeta = j?.item ?? {};
          if (!cancel) setMeta(chMeta);

          const midForApi = String(chMeta?.manga_id ?? '');
          const curCh     = String(chMeta?.chapter_number ?? '');
          // текущий том для URL — сначала из props.vol (если мы на маршруте с томом), иначе из meta
          const currentVolFromUrl = String((vol ?? chMeta?.vol ?? 'none'));

          if (midForApi && curCh) {
            const href = await findNextChapterFromList(
              numId(midForApi),
              curCh,
              currentVolFromUrl,
              (mangaId ?? midForApi) as string  // в URL сохраняем исходный slug/id
            );
            if (!cancel) setNextHref(href);
          } else if (!cancel) {
            setNextHref(null);
          }
          return;
        }

        // Режим без id: у нас есть mangaId + vol + chapter
        if (!byId && mangaId && chapter != null) {
          if (!cancel) setMeta({ manga_id: mangaId, vol, chapter_number: chapter });

          const href = await findNextChapterFromList(
            String(mangaIdForApi!),         // для API — числовой id
            String(chapter),
            String(vol ?? 'none'),
            String(mangaId)                 // что оставить в адресе (число или slug)
          );
          if (!cancel) setNextHref(href);
        }
      } catch {
        if (!cancel) setNextHref(null);
      }
    })();

    return () => { cancel = true; };
  }, [byId, chapterId, mangaId, mangaIdForApi, vol, chapter]);

  /* ---------- Translator teams ---------- */
  const [chapterTeams, setChapterTeams] = useState<TeamInfo[]>([]);

  const effectiveChapterId = useMemo(() => {
    if (byId && chapterId) return Number(chapterId);
    return Number(pages[0]?.chapter_id || 0);
  }, [byId, chapterId, pages]);

  useEffect(() => {
    let abort = false;
    (async () => {
      const cid = effectiveChapterId;
      if (!cid) { setChapterTeams([]); return; }
      try {
        const r = await fetch(`/api/chapters/${cid}/teams`, { cache: 'no-store' });
        const j = await r.json().catch(() => ({}));
        if (!abort) setChapterTeams((j?.items ?? []) as TeamInfo[]);
      } catch {
        if (!abort) setChapterTeams([]);
      }
    })();
    return () => { abort = true; };
  }, [effectiveChapterId]);

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

  const chapterIdForLike = useMemo(() => effectiveChapterId, [effectiveChapterId]);

  // Включаем «чёрный ридер»
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

  // Загрузка комментариев при смене страницы
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

  /* ---------- Page picker ---------- */
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
  const prevPage = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
    scrollToReaderTop();
  }, [scrollToReaderTop]);

  const goNext = useCallback(() => {
    // Внутри текущей главы
    if (index + 1 < pages.length) {
      setIndex((i) => i + 1);
      scrollToReaderTop();
      return;
    }
    // Переход к следующей главе (если есть)
    if (nextHref) {
      router.push(nextHref);
      return;
    }
    // Иначе — на страницу тайтла
    const mid = (meta?.manga_id ?? mangaId) as string | null;
    router.push(mid ? `/title/${mid}` : '/');
  }, [index, pages.length, nextHref, meta?.manga_id, mangaId, router, scrollToReaderTop]);

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

  /* ---------- Bookmark ---------- */
  const effectiveMangaId = useMemo(() => {
    if (!byId) return Number(mangaId ?? meta?.manga_id ?? 0);
    return Number(meta?.manga_id ?? 0);
  }, [byId, mangaId, meta?.manga_id]);

  const [bmHas, setBmHas] = useState(false);
  const [bmPage, setBmPage] = useState<number | null>(null);
  const [bmBusy, setBmBusy] = useState(false);

  useEffect(() => {
    const cid = effectiveChapterId;
    if (!cid || !userId) { setBmHas(false); setBmPage(null); return; }
    (async () => {
      try {
        const r = await fetch(`/api/reader/bookmarks?chapter_id=${cid}`, { cache: 'no-store', credentials: 'include' });
        const j = r.ok ? await r.json() : null;
        setBmHas(!!j?.has);
        setBmPage(j?.page ?? null);
      } catch {
        setBmHas(false);
        setBmPage(null);
      }
    })();
  }, [userId, effectiveChapterId]);

  const setOrToggleBookmark = useCallback(async () => {
    if (!userId) return alert('Войдите, чтобы ставить закладки');
    const cid = effectiveChapterId;
    const mid = effectiveMangaId;
    const currentPage = index + 1;
    if (!cid || !mid) return;

    setBmBusy(true);
    try {
      if (bmHas && bmPage === currentPage) {
        await fetch('/api/reader/bookmarks', {
          method: 'DELETE', credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chapter_id: cid })
        });
        setBmHas(false);
        setBmPage(null);
      } else {
        await fetch('/api/reader/bookmarks', {
          method: 'POST', credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ manga_id: mid, chapter_id: cid, page: currentPage })
        });
        setBmHas(true);
        setBmPage(currentPage);
      }
    } finally {
      setBmBusy(false);
    }
  }, [userId, effectiveChapterId, effectiveMangaId, index, bmHas, bmPage]);

  /* ---------- Early returns ---------- */
  if (loading) return <div className="p-6 text-slate-400">Загрузка главы…</div>;
  if (error) return <div className="p-6 text-red-400">Ошибка: {error}</div>;
  if (!pages.length) return <div className="p-6 text-slate-400">Страниц нет</div>;

  /* ---------- Derived ---------- */
  const current = pages[index];
  const pageToShow = index + 1;

  /* ---------- Styles ---------- */
  const pageSurface = 'bg-black text-white border border-black';
  const commentSurface = 'bg-[#1f1f1f] text-white border border-[#1a1a1a]';
  const softOnComment = 'bg-[#262626] border-[#2f2f2f]';
  const pillBtn =
    'px-3 py-1.5 rounded-full bg-[#2a2a2a] border border-[#3a3a3a] shadow-sm hover:bg-[#333333] text-[#e5e7eb] focus-visible:outline-none focus-visible:ring-2 ring-white/10';
  const sendBtn =
    'px-4 py-2 rounded-lg bg-[#2a2a2a] hover:bg-[#333333] text-[#e5e7eb] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 ring-white/20';
  const listItem =
    'w/full rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4 text-[#e5e7eb]';
  const replyBox = 'ml-6 mt-3 border-l border-[#2a2a2a] pl-4';

  /* ---------- Render ---------- */
  return (
    <>
      <div className="mx-auto max-w-5xl p-3 sm:p-6 space-y-6">
        <div ref={topRef} />

        {/* Картинка страницы */}
        <div className={`relative overflow-hidden rounded-xl ${pageSurface}`}>
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

        {/* Команды + лайк + закладка */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex-1">
            {chapterTeams.length >= 1 ? (
              <div className="flex flex-wrap items-center gap-2">
                {chapterTeams.map((t, idx) => (
                  <Link
                    key={t.id ?? `${t.slug}-${idx}`}
                    href={`/team/${t.slug ?? t.id}`}
                    className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 bg:white/5 border-white/10"
                    title={t.name ?? 'Команда перевода'}
                  >
                    {t.avatar_url ? (
                      <img src={t.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-white/10" />
                    )}
                    <span className="text-sm text-white">{t.name ?? 'Команда'}</span>
                    {t.verified ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/80">✔</span>
                    ) : null}
                  </Link>
                ))}
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 mt-0.5 text-sm bg-white/5 border-white/10 text-white">
                <div className="h-6 w-6 rounded-full bg-white/10" />
                Перевод: неизвестно
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {chapterIdForLike ? (
              <div
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 bg-white/5 border-white/10 text-white"
                data-like-scope
              >
                <ChapterLikeButton chapterId={chapterIdForLike} />
              </div>
            ) : null}

            <button
              onClick={setOrToggleBookmark}
              disabled={bmBusy || !userId || !effectiveChapterId}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-white hover:bg-white/10
                ${bmHas ? 'bg-white/20 border-white/20' : 'bg-white/5 border-white/10'}`}
              title={bmHas ? (bmPage ? `Закладка: стр. ${bmPage}` : 'Закладка установлена') : 'Поставить закладку на текущую страницу'}
            >
              {bmHas ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* ===== Комментарии ===== */}
        <section className="relative">
          <div className="relative left-1/2 -translate-x-1/2 w-screen bg-[#1f1f1f]">
            <div className="mx-auto max-w-5xl px-3 sm:px-6 py-6">
              <div className={`w-full rounded-xl p-4 ${commentSurface}`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => document.execCommand('bold')} className={pillBtn.replace('rounded-full','rounded-md')} title="Жирный"><Bold className="w-4 h-4" /></button>
                    <button onClick={() => document.execCommand('italic')} className={pillBtn.replace('rounded-full','rounded-md')} title="Курсив"><Italic className="w-4 h-4" /></button>
                    <button onClick={() => document.execCommand('underline')} className={pillBtn.replace('rounded-full','rounded-md')} title="Подчеркнуть"><Underline className="w-4 h-4" /></button>
                    <button
                      onClick={() => {
                        const didWork = document.execCommand('strikeThrough');
                        if (!didWork) { try { document.execCommand('strikethrough'); } catch {} }
                      }}
                      className={pillBtn.replace('rounded-full','rounded-md')}
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
                    className={`min-h-[64px] rounded-lg p-3 outline-none bg-[#262626] text-[#e5e7eb] ${!!userId ? '' : 'opacity-60'} focus-visible:ring-2 ring-white/10`}
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

              {/* Список комментариев */}
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
                            <img src={teams[c.team_id]!.avatar_url!} alt="" className="w-10 h-10 rounded-full object-cover" />
                          ) : c.user_id && profiles[c.user_id]?.avatar_url ? (
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
                            <div ref={editRef} contentEditable suppressContentEditableWarning className="min-h-[64px] rounded-lg p-3 outline-none bg-[#262626] text-[#e5e7eb] focus-visible:ring-2 ring-white/10" />
                            <div className="mt-2 flex gap-2 justify-end">
                              <button onClick={() => saveEdit(c.id)} className={sendBtn}>Сохранить</button>
                              <button onClick={() => { setEditingId(null); if (editRef.current) (editRef.current as any).innerHTML = ''; }} className="px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5">
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
                                    className={`rounded-lg p-3 ${r.is_pinned ? 'bg-[#23272e] border border-[#39414f]' : 'bg-[#262626]'}`}
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
                                            <button onClick={() => startEdit(r.id, r.content)} className="inline-flex items-center gap-1 text-[11px] opacity-90 hover:opacity-100"><Pencil className="w-3 h-3" /> Редактировать</button>
                                            <button onClick={() => deleteComment(r.id)} className="inline-flex items-center gap-1 text-[11px] opacity-90 hover:opacity-100"><Trash2 className="w-3 h-3" /> Удалить</button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    {editingId === r.id ? (
                                      <div className="mt-1">
                                        <div ref={editRef} contentEditable suppressContentEditableWarning className="min-h-[64px] rounded-lg p-3 outline-none bg-[#262626] text-[#e5e7eb] focus-visible:ring-2 ring-white/10" />
                                        <div className="mt-2 flex gap-2 justify-end">
                                          <button onClick={() => saveEdit(r.id)} className={sendBtn}>Сохранить</button>
                                          <button onClick={() => { setEditingId(null); if (editRef.current) (editRef.current as any).innerHTML = ''; }} className="px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5">Отмена</button>
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