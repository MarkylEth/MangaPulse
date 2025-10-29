// components/reader/ChapterComments/index.tsx
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import CommentEditor from './CommentEditor';
import CommentsList from './CommentsList';
import type { PageComment, Profile, Team, SortMode } from '@/lib/reader/types';

interface ChapterCommentsProps {
  pageId: number;
  userId: string | null;
}

export default function ChapterComments({ pageId, userId }: ChapterCommentsProps) {
  const [comments, setComments] = useState<PageComment[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [teams, setTeams] = useState<Record<number, Team>>({});
  const [likedByMe, setLikedByMe] = useState<Record<string, boolean>>({});
  const [likesCount, setLikesCount] = useState<Record<string, number>>({});
  const [sortMode, setSortMode] = useState<SortMode>('new');
  const [replyTo, setReplyTo] = useState<{ id: string } | null>(null);

  const loadComments = useCallback(
    async (signal?: AbortSignal) => {
      const url = `/api/reader/pages/${pageId}/comments${
        userId ? `?user=${encodeURIComponent(userId)}` : ''
      }`;
      
      try {
        const r = await fetch(url, { cache: 'no-store', signal, credentials: 'include' });
        const j = await r.json().catch(() => ({}));

        const items: PageComment[] = j?.items ?? [];
        setComments(items);
        setProfiles(j?.users ?? {});
        setTeams(j?.teams ?? {});

        const likes: Record<string, number> = {};
        items.forEach((c) => {
          likes[c.id] = c.likes_count ?? 0;
        });
        setLikesCount(likes);
        setLikedByMe(j?.likedByMe ?? {});
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Failed to load comments:', err);
        }
      }
    },
    [pageId, userId]
  );

  useEffect(() => {
    const ctrl = new AbortController();
    loadComments(ctrl.signal);
    return () => ctrl.abort();
  }, [loadComments]);

  const onCommentSent = useCallback(() => {
    setReplyTo(null);
    loadComments();
  }, [loadComments]);

  return (
    <section className="relative">
      <div className="relative left-1/2 -translate-x-1/2 w-screen bg-[#1f1f1f]">
        <div className="mx-auto max-w-5xl px-3 sm:px-6 py-6">
          <CommentEditor
            pageId={pageId}
            userId={userId}
            replyTo={replyTo}
            onReplyCancel={() => setReplyTo(null)}
            onCommentSent={onCommentSent}
            sortMode={sortMode}
            onSortChange={setSortMode}
          />

          <CommentsList
            comments={comments}
            profiles={profiles}
            teams={teams}
            likedByMe={likedByMe}
            likesCount={likesCount}
            setLikedByMe={setLikedByMe}
            setLikesCount={setLikesCount}
            setComments={setComments}
            userId={userId}
            sortMode={sortMode}
            onReply={(id) => setReplyTo({ id })}
          />
        </div>
      </div>
    </section>
  );
}