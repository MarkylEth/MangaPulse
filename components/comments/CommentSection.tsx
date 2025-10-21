// components/comments/CommentSection.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
// ⬇⬇⬇ было: import { CommentEditor, type ReplyTo } from './CommentEditor';
import CommentEditor, { type ReplyTo } from './CommentEditor';
import { CommentList, type CommentRow } from './CommentList';

/* ===== utils ===== */
async function safeJson<T = any>(res: Response): Promise<T | null> {
  const ct = res.headers.get('content-type') || '';
  const txt = await res.text();
  if (!txt) return null;
  if (ct.includes('application/json')) {
    try { return JSON.parse(txt) as T; } catch { return null; }
  }
  return null;
}
async function getJson(url: string) {
  try {
    const r = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    });
    const data = await safeJson(r);
    return r.ok ? (data ?? {}) : {};
  } catch {
    return {};
  }
}

export default function CommentSection({
  mangaId,
  me,
  canEdit,
  leaderTeamId,
  initialItems,
}: {
  mangaId: number;
  me: { id: string; role?: string | null } | null;
  canEdit: boolean;
  leaderTeamId: number | null;
  initialItems?: CommentRow[];
}) {
  const maxChars: number | null = canEdit ? null : (leaderTeamId ? 1500 : 400);

  const [items, setItems] = useState<CommentRow[]>(initialItems ?? []);
  const [loaded, setLoaded] = useState<boolean>(!!initialItems);
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);

  const [cursor, setCursor] = useState<string | null>(null);
  const [isPaged, setIsPaged] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (loaded) return;
    let stop = false;
    (async () => {
      let res: any = await getJson(`/api/manga/${mangaId}/comments?paged=1&limit=15`);
      if (stop) return;

      if (res?.mode === 'paged') {
        setIsPaged(true);
        const rootsOnly: CommentRow[] = [...(res.pinned ?? []), ...(res.items ?? [])];
        setItems(rootsOnly);
        setCursor(res.nextCursor ?? null);
        setLoaded(true);
        return;
      }

      res = await getJson(`/api/manga/${mangaId}/comments`);
      if (stop) return;
      if (Array.isArray(res?.items)) setItems(res.items);
      setIsPaged(false);
      setCursor(null);
      setLoaded(true);
    })();
    return () => { stop = true; };
  }, [loaded, mangaId]);

  const threads = useMemo(() => {
    const roots: CommentRow[] = [];
    const children: Record<string, CommentRow[]> = {};
    for (const c of items) {
      const pid = c.parent_id ?? null;
      if (pid) (children[pid] ||= []).push(c);
      else roots.push(c);
    }
    return { roots, children };
  }, [items]);

  const reload = useCallback(async () => {
    if (!isPaged) {
      const res: any = await getJson(`/api/manga/${mangaId}/comments`);
      if (Array.isArray(res?.items)) setItems(res.items);
      return;
    }
    const res: any = await getJson(`/api/manga/${mangaId}/comments?paged=1&limit=15`);
    const rootsOnly: CommentRow[] = [...(res?.pinned ?? []), ...(res?.items ?? [])];
    setItems(rootsOnly);
    setCursor(res?.nextCursor ?? null);
  }, [mangaId, isPaged]);

  const submit = useCallback(
    async (html: string, parentId: string | null) => {
      if (!me) { alert('Войдите в аккаунт, чтобы комментировать'); return; }
      setSubmitting(true);
      try {
        const payload = { body: html, comment: html, parent_id: parentId };
        const r = await fetch(`/api/manga/${mangaId}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
        const data = await safeJson<{ message?: string }>(r);
        if (!r.ok) {
          if (r.status === 401) throw new Error('Нужно войти в аккаунт');
          throw new Error(data?.message || `HTTP ${r.status}`);
        }
        await reload();
        setReplyTo(null);
      } catch (e: any) {
        alert(e?.message || 'Ошибка отправки комментария');
      } finally {
        setSubmitting(false);
      }
    },
    [me, mangaId, reload]
  );

  const togglePin = useCallback(async (c: CommentRow, nextPinned?: boolean) => {
    const allowed = canEdit || !!leaderTeamId;
    if (!allowed) return;
    if (c.parent_id != null) { alert('Закреплять можно только корневые комментарии.'); return; }

    const target = typeof nextPinned === 'boolean' ? nextPinned : !c.is_pinned;

    setItems(prev => {
      if (target) return prev.map(x => (x.parent_id == null ? { ...x, is_pinned: x.id === c.id } : x));
      return prev.map(x => (x.id === c.id ? { ...x, is_pinned: false } : x));
    });

    try {
      const res = await fetch(`/api/manga/${mangaId}/comments/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_pinned: target }),
      });
      const j = await safeJson(res);
      if (!res.ok) {
        setItems(prev =>
          prev.map(x =>
            x.parent_id == null
              ? (x.id === c.id ? { ...x, is_pinned: !target } : x)
              : x
          )
        );
        throw new Error((j as any)?.message || `HTTP ${res.status}`);
      }
    } catch (e: any) {
      alert(e?.message || 'Ошибка');
    }
  }, [mangaId, canEdit, leaderTeamId]);

  const del = useCallback(async (c: CommentRow) => {
    const isAuthor = me?.id && c.user_id === me.id;
    const allowed = Boolean(isAuthor || canEdit);
    if (!allowed) return;

    try {
      const res = await fetch(`/api/manga/${mangaId}/comments/${c.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const j = await safeJson(res);
      if (!res.ok) throw new Error((j as any)?.message || `HTTP ${res.status}`);
      await reload();
    } catch (e: any) {
      alert(e?.message || 'Ошибка');
    }
  }, [mangaId, me, canEdit, reload]);

  const bumpReportLocally = useCallback((id: string, willHide: boolean) => {
    setItems(prev => prev.map(x => x.id !== id ? x : ({
      ...x,
      reports_count: Number(x.reports_count ?? 0) + 1,
      is_hidden: willHide ? true : x.is_hidden,
    })));
  }, []);

  const loadMore = useCallback(async () => {
    if (!isPaged || !cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res: any = await getJson(
        `/api/manga/${mangaId}/comments?paged=1&limit=15&cursor=${encodeURIComponent(cursor)}`
      );
      const more: CommentRow[] = res?.items ?? [];
      setItems(prev => {
        const seen = new Set(prev.map(x => x.id));
        const deduped = more.filter(x => !seen.has(x.id));
        return deduped.length ? [...prev, ...deduped] : prev;
      });
      setCursor(res?.nextCursor ?? null);
    } finally {
      setLoadingMore(false);
    }
  }, [isPaged, cursor, loadingMore, mangaId]);

  return (
    <div className="space-y-4">
      <CommentEditor
        me={me ? { id: me.id } : null}
        maxChars={maxChars}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onSubmit={submit}
        submitting={submitting}
      />

      <CommentList
        roots={threads.roots}
        childrenMap={threads.children}
        me={me ? { id: me.id } : null}
        canEdit={canEdit}
        leaderTeamId={leaderTeamId}
        mangaId={mangaId}
        onReply={(id, username) => setReplyTo({ id, username })}
        onPinnedToggle={(c) => togglePin(c, !c.is_pinned)}
        onDelete={del}
        onReportedLocally={bumpReportLocally}
        externalLoadMore={
          isPaged
            ? {
                visible: !!cursor,
                disabled: loadingMore,
                onClick: loadMore,
                label: loadingMore ? 'Загрузка…' : 'Загрузить ещё',
              }
            : undefined
        }
      />
    </div>
  );
}
