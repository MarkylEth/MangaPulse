// components/reader/ChapterComments/CommentsList.tsx
'use client';

import React from 'react';
import CommentItem from './CommentItem';
import type { PageComment, Profile, Team, SortMode } from '@/lib/reader/types';

interface CommentsListProps {
  comments: PageComment[];
  profiles: Record<string, Profile>;
  teams: Record<number, Team>;
  likedByMe: Record<string, boolean>;
  likesCount: Record<string, number>;
  setLikedByMe: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setLikesCount: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setComments: React.Dispatch<React.SetStateAction<PageComment[]>>;
  userId: string | null;
  sortMode: SortMode;
  onReply: (id: string) => void;
}

export default function CommentsList({
  comments,
  profiles,
  teams,
  likedByMe,
  likesCount,
  setLikedByMe,
  setLikesCount,
  setComments,
  userId,
  sortMode,
  onReply,
}: CommentsListProps) {
  // Sort logic
  const roots = comments.filter((c) => !c.parent_id);
  const childrenMap = comments.reduce<Record<string, PageComment[]>>((acc, c) => {
    if (c.parent_id) (acc[c.parent_id] ||= []).push(c);
    return acc;
  }, {});

  const cmpNew = (a: PageComment, b: PageComment) =>
    +new Date(b.created_at) - +new Date(a.created_at);
  const cmpOld = (a: PageComment, b: PageComment) =>
    +new Date(a.created_at) - +new Date(b.created_at);
  const cmpTop = (a: PageComment, b: PageComment) =>
    (likesCount[b.id] ?? 0) - (likesCount[a.id] ?? 0) || cmpNew(a, b);

  const base = sortMode === 'new' ? cmpNew : sortMode === 'old' ? cmpOld : cmpTop;

  const sortWithPinned =
    (fn: (a: PageComment, b: PageComment) => number) =>
    (a: PageComment, b: PageComment) => {
      const pa = a.is_pinned ? 1 : 0;
      const pb = b.is_pinned ? 1 : 0;
      return pb - pa || fn(a, b);
    };

  const sortFn = sortWithPinned(base);

  const toggleLike = async (id: string) => {
    if (!userId) {
      alert('Войдите');
      return;
    }

    const liked = !!likedByMe[id];
    const url = `/api/reader/comments/${encodeURIComponent(id)}/like`;

    try {
      if (liked) {
        await fetch(url, {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ user_id: userId }),
        });
        setLikedByMe((m) => ({ ...m, [id]: false }));
        setLikesCount((m) => ({ ...m, [id]: Math.max(0, (m[id] ?? 1) - 1) }));
      } else {
        await fetch(url, {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ user_id: userId }),
        });
        setLikedByMe((m) => ({ ...m, [id]: true }));
        setLikesCount((m) => ({ ...m, [id]: (m[id] ?? 0) + 1 }));
      }
    } catch (e: any) {
      alert(e?.message ?? 'Не удалось изменить лайк');
    }
  };

  const deleteComment = async (id: string) => {
    if (!userId) return;
    if (!confirm('Удалить комментарий?')) return;

    try {
      const r = await fetch(`/api/reader/comments/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      const j = await r.json().catch(() => ({}));
      
      if (!r.ok || !j?.ok) throw new Error(j?.error || 'Не удалось удалить');

      setComments((prev) => prev.filter((c) => c.id !== id && c.parent_id !== id));
    } catch (e: any) {
      alert(e?.message || 'Не удалось удалить');
    }
  };

  const saveEdit = async (id: string, html: string) => {
    if (!userId) return;

    try {
      const r = await fetch(`/api/reader/comments/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user_id: userId, content: html }),
      });
      const j = await r.json().catch(() => ({}));
      
      if (!r.ok || !j?.ok) throw new Error(j?.error || 'Не удалось сохранить');

      setComments((prev) =>
        prev.map((c) => (c.id === id ? { ...c, content: html, is_edited: true } : c))
      );
    } catch (e: any) {
      alert(e?.message || 'Не удалось сохранить');
    }
  };

  const nameOf = (c: PageComment) => {
    if (c.is_team_comment && c.team_id != null) {
      return teams[c.team_id]?.name ?? 'Команда';
    }
    return c.user_id ? profiles[c.user_id]?.username ?? 'Без имени' : 'Аноним';
  };

  if (roots.length === 0) {
    return (
      <div className="mt-4 text-center text-sm text-[#9ca3af]">
        Пока нет комментариев к этой странице — будьте первым!
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {roots.sort(sortFn).map((comment) => {
        const replies = (childrenMap[comment.id] ?? []).sort(sortFn);

        return (
          <CommentItem
            key={comment.id}
            comment={comment}
            replies={replies}
            profiles={profiles}
            teams={teams}
            likedByMe={likedByMe}
            likesCount={likesCount}
            userId={userId}
            nameOf={nameOf}
            onReply={onReply}
            onToggleLike={toggleLike}
            onDelete={deleteComment}
            onSaveEdit={saveEdit}
          />
        );
      })}
    </div>
  );
}