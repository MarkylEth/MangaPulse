// components/news/NewsView.tsx
'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Clock, MessageSquare, Pin, Trash2, Shield, ArrowLeft } from 'lucide-react';
import { Header } from '@/components/Header';
import { useTheme } from '@/lib/theme/context';
import { useAuth } from '@/components/auth/AuthProvider';

import NewsBody from '@/components/news/formatNews';
import NewsCommentEditor, { sanitize, convertSpoilers } from '@/components/news/NewsCommentEditor';
import { AvatarImg, RoleBadge, safeDateLabel, type Role } from './parts';

const LOADING_GIF_SRC = '/images/profile-loading.gif';

type NewsItem = {
  id: number;
  title: string;
  body: string;
  pinned: boolean;
  visible: boolean;
  created_at: string;
  author_id: string;
  author_name: string | null;
  author_avatar: string | null;
  author_role: Role;
};

type CommentItem = {
  id: number;
  body: string;
  created_at: string;
  author_id: string;
  author_name: string | null;
  author_avatar: string | null;
};

function DeleteModal({
  open, onClose, onConfirm, busy,
}: { open: boolean; onClose: () => void; onConfirm: () => void; busy?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-sm rounded-2xl bg-white/85 dark:bg-[#0f1115]/85 backdrop-blur-xl border border-black/10 dark:border-white/10 p-6 shadow-[0_20px_80px_rgba(0,0,0,.55)] mx-4">
        <h3 className="text-lg font-semibold mb-2">Удалить комментарий ?</h3>
        <p className="text-sm text-[rgb(var(--muted-foreground))] mb-6">
          Комментарий будет удален без возможности восстановления.
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-sm font-medium transition-all" disabled={busy}>
            Отмена
          </button>
          <button onClick={onConfirm} disabled={busy}
                  className="px-4 py-2 rounded-xl bg-red-500/90 hover:bg-red-600 text-white text-sm font-semibold transition-all disabled:opacity-60">
            {busy ? 'Удаляю…' : 'Удалить'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NewsView() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);

  const PAGE = 15;

  const [item, setItem] = React.useState<NewsItem | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [comments, setComments] = React.useState<CommentItem[]>([]);
  const [shown, setShown] = React.useState<number>(PAGE);
  const [busy, setBusy] = React.useState(false);

  const [deletingCommentId, setDeletingCommentId] = React.useState<number | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = React.useState(false);
  const [pendingDeleteId, setPendingDeleteId] = React.useState<number | null>(null);

  const commentsContainerRef = React.useRef<HTMLDivElement | null>(null);

  const isModerator = React.useMemo(() => user?.role === 'admin' || user?.role === 'moderator', [user]);

  const loadPost = React.useCallback(async () => {
    if (!Number.isFinite(id)) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/news/${id}`, { cache: 'no-cache', credentials: 'include' });
      setItem(r.ok ? (await r.json())?.data ?? null : null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadComments = React.useCallback(async () => {
    if (!Number.isFinite(id)) return;
    const r = await fetch(`/api/news/${id}/comments`, { cache: 'no-store', credentials: 'include' });
    const j = r.ok ? await r.json() : { data: [] };
    const arr = Array.isArray(j?.data) ? (j.data as CommentItem[]) : [];
    setComments(arr);
    setShown((prev) => (prev < PAGE ? PAGE : prev));
  }, [id]);

  const deleteComment = React.useCallback(
    async (commentId: number) => {
      setDeletingCommentId(commentId);
      try {
        const r = await fetch(`/api/news/${id}/comments/${commentId}`, { method: 'DELETE', credentials: 'include' });
        if (r.ok) {
          await loadComments();
        } else {
          const j = await r.json().catch(() => ({}));
          alert(j?.error || 'Не удалось удалить комментарий');
        }
      } catch (err) {
        console.error('Delete comment error:', err);
        alert('Ошибка при удалении комментария');
      } finally {
        setDeletingCommentId(null);
      }
    },
    [id, loadComments]
  );

  const confirmDelete = React.useCallback(async () => {
    if (pendingDeleteId == null) return;
    await deleteComment(pendingDeleteId);
    setPendingDeleteId(null);
    setDeleteModalOpen(false);
  }, [pendingDeleteId, deleteComment]);

  React.useEffect(() => {
    if (!Number.isFinite(id)) return;
    setShown(PAGE);
    loadPost();
    loadComments();
  }, [id, loadPost, loadComments]);

  React.useEffect(() => {
    const el = commentsContainerRef.current;
    if (!el) return;

    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t && t.classList.contains('spoiler-blur')) t.classList.toggle('revealed');
    };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (!t || !t.classList.contains('spoiler-blur')) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        t.classList.toggle('revealed');
      }
    };

    el.addEventListener('click', onClick);
    el.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('click', onClick);
      el.removeEventListener('keydown', onKey);
    };
  }, [comments]);

  const canDeleteComment = (c: CommentItem) =>
    !!user && (String(user.id) === c.author_id || isModerator);

  const sortedComments = React.useMemo(() => {
    const arr = comments.slice();
    arr.sort((a, b) => {
      const t = +new Date(b.created_at) - +new Date(a.created_at);
      if (t !== 0) return t;
      return Number(b.id) - Number(a.id);
    });
    return arr;
  }, [comments]);

  const visible = React.useMemo(() => sortedComments.slice(0, shown), [sortedComments, shown]);
  const hasMore = sortedComments.length > shown;

  if (loading && !item) {
    return (
      <div className="min-h-screen bg-[rgb(var(--background))] text-[rgb(var(--foreground))]">
        <Header showSearch={false} />
        <main className="relative max-w-[1400px] mx-auto px-6 py-12">
          <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
            <div className="rounded-2xl overflow-hidden ring-1 ring-border/40 shadow-lg">
              <img
                src={LOADING_GIF_SRC} alt="Загрузка…" className="block w-36 h-36 md:w-52 md:h-52 object-cover select-none"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <p className="text-muted-foreground">Загрузка новости…</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--background))] text-[rgb(var(--foreground))]">
      <Header showSearch={false} />

      <div className="px-4 sm:px-6 py-6 max-w-3xl mx-auto">
        <button
          onClick={() => router.push('/news')}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[rgb(var(--border))] hover:bg-[rgb(var(--muted))] transition-colors text-sm font-medium mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад
        </button>

        <article className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-6">
              <div className="h-8 bg-[rgb(var(--muted))] rounded animate-pulse mb-4" />
              <div className="h-4 bg-[rgb(var(--muted))] rounded animate-pulse w-2/3 mb-6" />
              <div className="space-y-3">
                <div className="h-4 bg-[rgb(var(--muted))] rounded animate-pulse" />
                <div className="h-4 bg-[rgb(var(--muted))] rounded animate-pulse" />
                <div className="h-4 bg-[rgb(var(--muted))] rounded animate-pulse w-5/6" />
              </div>
            </div>
          ) : !item ? (
            <div className="text-center py-16">
              <p className="text-[rgb(var(--muted-foreground))]">Новость не найдена</p>
            </div>
          ) : (
            <>
              <header className="px-6 py-6">
                {item.pinned && (
                  <div className="mb-4">
                    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))] border border-[rgb(var(--border))]">
                      <Pin className="w-3 h-3" />
                      Закреплено
                    </span>
                  </div>
                )}

                <h1 className="text-3xl font-semibold leading-tight mb-5">{item.title}</h1>

                <div className="flex flex-wrap items-center gap-4 text-sm text-[rgb(var(--muted-foreground))]">
                  <div className="inline-flex items-center gap-2">
                    <AvatarImg src={item.author_avatar} size={24} />
                    <span className="font-medium">{item.author_name || 'Пользователь'}</span>
                    <RoleBadge role={item.author_role} />
                  </div>

                  <div className="inline-flex items-centered gap-1.5">
                    <Clock className="w-4 h-4" />
                    {safeDateLabel(item.created_at)}
                  </div>
                </div>
              </header>

              <div className="h-px mx-6 bg-[rgb(var(--border))]" />

              <div className="px-6 py-6 text-[15px] leading-relaxed">
                <NewsBody text={item.body} />
              </div>
            </>
          )}
        </article>

        <section className="mt-6 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] overflow-hidden shadow-sm">
          <div className="px-6 py-4 flex items-center gap-2.5">
            <MessageSquare className="w-5 h-5" />
            <h2 className="font-semibold text-base">
              Комментарии
              {comments.length > 0 && (
                <span className="ml-2 text-sm font-normal text-[rgb(var(--muted-foreground))]">
                  {comments.length}
                </span>
              )}
            </h2>
          </div>

          <div className="h-px bg-[rgb(var(--border))]" />

          {user && (
            <>
              <div className="px-6 py-5">
                <NewsCommentEditor
                  me={{ id: String(user.id) }}
                  disabled={busy}
                  replyTo={null}
                  onCancelReply={() => {}}
                  submitting={busy}
                  maxChars={400}
                  maxLines={10}
                  onSubmit={async (html) => {
                    if (!Number.isFinite(id)) return;
                    setBusy(true);
                    try {
                      const response = await fetch(`/api/news/${id}/comments`, {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ body: html }),
                      });
                      if (!response.ok) {
                        const error = await response.json().catch(() => ({}));
                        alert(error?.error || 'Ошибка при отправке комментария');
                        return;
                      }
                      await loadComments();
                      setShown((n) => Math.max(PAGE, n));
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              </div>
              <div className="h-px bg-[rgb(var(--border))]" />
            </>
          )}

          {comments.length > 0 ? (
            <>
              <div className="px-6 py-4" ref={commentsContainerRef}>
                <ul className="divide-y divide-[rgb(var(--border))]">
                  {visible.map((c) => (
                    <li key={c.id} className="py-4 relative group">
                      <div className="flex items-start gap-3">
                        <AvatarImg src={c.author_avatar} size={36} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-sm">{c.author_name || 'Пользователь'}</span>
                            <span className="text-xs text-[rgb(var(--muted-foreground))]">
                              {safeDateLabel(c.created_at)}
                            </span>
                          </div>
                          <div
                            className="text-[15px] leading-relaxed prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: convertSpoilers(sanitize(c.body)) }}
                          />
                        </div>

                        {canDeleteComment(c) && (
                          <button
                            onClick={() => { setPendingDeleteId(c.id); setDeleteModalOpen(true); }}
                            disabled={deletingCommentId === c.id}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-red-500/10 text-red-500 disabled:opacity-50 flex items-center gap-1"
                            title={isModerator && String(user?.id) !== c.author_id ? 'Удалить как модератор' : 'Удалить комментарий'}
                          >
                            <Trash2 className="w-4 h-4" />
                            {isModerator && String(user?.id) !== c.author_id && <Shield className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {hasMore && (
                <div className="flex justify-center pb-6">
                  <button
                    onClick={() => setShown((n) => n + PAGE)}
                    className="inline-flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-medium
                               border border-black/10 dark:border-white/10
                               bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10
                               text-gray-800 dark:text-gray-200 transition"
                  >
                    Загрузить ещё
                  </button>
                </div>
              )}
            </>
          ) : (
            !user && (
              <div className="px-6 py-12 text-center text-[rgb(var(--muted-foreground))]">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Пока нет комментариев</p>
                <p className="text-xs mt-1">Войдите, чтобы оставить комментарий</p>
              </div>
            )
          )}
        </section>
      </div>

      <DeleteModal
        open={deleteModalOpen}
        busy={pendingDeleteId != null && deletingCommentId === pendingDeleteId}
        onClose={() => {
          if (deletingCommentId == null) { setDeleteModalOpen(false); setPendingDeleteId(null); }
        }}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
