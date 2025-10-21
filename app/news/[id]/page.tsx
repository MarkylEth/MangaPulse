// app/news/[id]/page.tsx
'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Clock, MessageSquare, User, ArrowLeft, Megaphone, Pin, Trash2 } from 'lucide-react';
import { Header } from '@/components/Header';
import { useTheme } from '@/lib/theme/context';
import { useAuth } from '@/components/auth/AuthProvider';

import NewsBody from '@/components/comments/news/formatNews';
import CommentEditor, { sanitize } from '@/components/comments/CommentEditor';

/* ================= Types ================= */
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
};
type CommentItem = {
  id: number;
  body: string;
  created_at: string;
  author_id: string;
  author_name: string | null;
  author_avatar: string | null;
};

/* =============== UI tone =============== */
function useTone() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  return {
    page: isLight ? 'min-h-screen bg-white text-black' : 'min-h-screen bg-[#0f0f0f] text-white',
    card: isLight ? 'bg-black/5' : 'bg-[#1a1a1a]',
    border: isLight ? 'border-black/10' : 'border-white/10',
    muted: isLight ? 'text-gray-600' : 'text-gray-400',
  };
}

/* =============== helpers =============== */
const fmtDate = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
function safeDateLabel(s?: string | null) {
  if (!s) return '—';
  const d = new Date(s);
  return Number.isFinite(+d) ? fmtDate.format(d) : '—';
}

function AvatarImg({ src, size = 36 }: { src?: string | null; size?: number }) {
  return (
    <div className="relative shrink-0 overflow-hidden rounded-full" style={{ width: size, height: size }}>
      {src ? (
        <img
          src={src}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-black/10 dark:bg-white/10">
          <User className="w-1/2 h-1/2 opacity-70" />
        </div>
      )}
    </div>
  );
}

export default function NewsPage() {
  const { user } = useAuth();
  const t = useTone();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);

  const [item, setItem] = React.useState<NewsItem | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [comments, setComments] = React.useState<CommentItem[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [deletingCommentId, setDeletingCommentId] = React.useState<number | null>(null);

  const loadPost = React.useCallback(async () => {
    if (!Number.isFinite(id)) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/news/${id}`, { cache: 'force-cache', credentials: 'include' });
      setItem(r.ok ? (await r.json())?.data ?? null : null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadComments = React.useCallback(async () => {
    if (!Number.isFinite(id)) return;
    const r = await fetch(`/api/news/${id}/comments`, { cache: 'no-store', credentials: 'include' });
    const j = r.ok ? await r.json() : { data: [] };
    setComments(Array.isArray(j?.data) ? j.data : []);
  }, [id]);

  const deleteComment = React.useCallback(
    async (commentId: number) => {
      if (!window.confirm('Удалить комментарий?')) return;

      setDeletingCommentId(commentId);
      try {
        const r = await fetch(`/api/news/${id}/comments/${commentId}`, {
          method: 'DELETE',
          credentials: 'include',
        });

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

  React.useEffect(() => {
    if (!Number.isFinite(id)) return;
    loadPost();
    loadComments();
  }, [id, loadPost, loadComments]);

  return (
    <div className={t.page}>
      <Header showSearch={false} />

      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <button
          onClick={() => router.push('/')}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${t.border} hover:bg-black/5 dark:hover:bg-white/10`}
        >
          <ArrowLeft className="w-4 h-4" />
          На главную
        </button>

        {/* карточка новости */}
        <div className={`mt-4 rounded-2xl border ${t.border} ${t.card} p-5`}>
          {loading ? (
            <div className="h-40 animate-pulse rounded-xl border border-dashed" />
          ) : !item ? (
            <div className="text-center py-16">Новость не найдена.</div>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg border bg-black/10 dark:bg-white/10">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold leading-snug">{item.title}</h1>
                    {item.pinned && (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-amber-500/40 text-amber-300 bg-amber-500/10">
                        <Pin className="w-3.5 h-3.5" /> закреплено
                      </span>
                    )}
                  </div>

                  <div className={`mt-1 flex flex-wrap items-center gap-3 text-[13px] ${t.muted}`}>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {safeDateLabel(item.created_at)}
                    </span>

                    <span className="inline-flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span className="inline-flex items-center gap-2">
                        <AvatarImg src={item.author_avatar} size={18} />
                        <span className="font-medium">{item.author_name || 'Пользователь'}</span>
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 text-[15px] leading-relaxed">
                <NewsBody text={item.body} />
              </div>
            </>
          )}
        </div>

        {/* Комментарии */}
        <div className={`mt-6 rounded-2xl border ${t.border} ${t.card}`}>
          <div className="px-5 pt-4 pb-2 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-sky-500" />
            <div className="uppercase text-xs tracking-wider">Комментарии</div>
          </div>

          {/* Форма */}
          <div className="px-5 pb-5">
            <div className="flex items-start gap-3">
              <AvatarImg src={user?.avatar_url as string | undefined} size={36} />
              <div className="flex-1">
                <CommentEditor
                  me={user ? { id: String(user.id) } : null}
                  disabled={busy}
                  replyTo={null}
                  onCancelReply={() => {}}
                  submitting={busy}
                  maxChars={1000}
                  maxLines={35}
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
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* список комментариев */}
          <div className="px-5 pb-5">
            {comments.length === 0 ? (
              <div className="text-sm opacity-75">Пока нет комментариев.</div>
            ) : (
              <ul className="space-y-3">
                {comments.map((c) => (
                  <li key={c.id} className={`p-3 rounded-xl border ${t.border} relative group`}>
                    <div className="flex items-start gap-2">
                      <AvatarImg src={c.author_avatar} size={36} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-semibold">{c.author_name || 'Пользователь'}</span>
                          <span className="text-[12px] opacity-70">{safeDateLabel(c.created_at)}</span>
                        </div>
                        <div
                          className="mt-1 text-[15px] leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: sanitize(c.body) }}
                        />
                      </div>

                      {/* Кнопка удаления */}
                      {user && String(user.id) === c.author_id && (
                        <button
                          onClick={() => deleteComment(c.id)}
                          disabled={deletingCommentId === c.id}
                          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-500/10 text-red-500 disabled:opacity-50"
                          title="Удалить комментарий"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}