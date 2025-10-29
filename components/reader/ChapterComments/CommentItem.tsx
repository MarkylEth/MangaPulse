// components/reader/ChapterComments/CommentItem.tsx
'use client';

import React, { useRef, useState } from 'react';
import {
  CornerDownRight,
  Heart,
  Pencil,
  Trash2,
  Pin,
} from 'lucide-react';
import type { PageComment, Profile, Team } from '@/lib/reader/types';

interface CommentItemProps {
  comment: PageComment;
  replies: PageComment[];
  profiles: Record<string, Profile>;
  teams: Record<number, Team>;
  likedByMe: Record<string, boolean>;
  likesCount: Record<string, number>;
  userId: string | null;
  nameOf: (c: PageComment) => string;
  onReply: (id: string) => void;
  onToggleLike: (id: string) => void;
  onDelete: (id: string) => void;
  onSaveEdit: (id: string, html: string) => void;
}

function sanitize(input: string) {
  let html = (input || '').replace(/&nbsp;/gi, ' ');
  html = html.replace(/<strike\b[^>]*>/gi, '<s>').replace(/<\/strike>/gi, '</s>');
  const allow = ['b', 'i', 'u', 's', 'del', 'strong', 'em', 'br'].join('|');
  html = html.replace(new RegExp(String.raw`<(?!\/?(?:${allow})\b)[^>]*>`, 'gi'), '');
  html = html.replace(new RegExp(String.raw`<(?:${allow})>\s*<\/(?:${allow})>`, 'gi'), '');
  html = html.replace(/(?:<br\s*\/?>\s*){3,}/gi, '<br><br>');
  return html.trim();
}

export default function CommentItem({
  comment,
  replies,
  profiles,
  teams,
  likedByMe,
  likesCount,
  userId,
  nameOf,
  onReply,
  onToggleLike,
  onDelete,
  onSaveEdit,
}: CommentItemProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editRef = useRef<HTMLDivElement>(null);

  const me = comment.user_id === userId;

  const startEdit = (id: string, html: string) => {
    setEditingId(id);
    setTimeout(() => {
      if (editRef.current) editRef.current.innerHTML = html;
    }, 0);
  };

  const saveEdit = (id: string) => {
    const html = sanitize(editRef.current?.innerHTML ?? '');
    if (!html) return;
    onSaveEdit(id, html);
    setEditingId(null);
  };

  const listItem = 'w-full rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4 text-[#e5e7eb]';
  const replyBox = 'ml-6 mt-3 border-l border-[#2a2a2a] pl-4';
  const sendBtn =
    'px-4 py-2 rounded-lg bg-[#2a2a2a] hover:bg-[#333333] text-[#e5e7eb] disabled:opacity-50';

  return (
    <article
      className={`${listItem} ${comment.is_pinned ? 'bg-[#23272e] border-[#39414f]' : ''}`}
    >
      {/* Header */}
      <header className="flex items-center gap-3">
        {comment.is_team_comment && comment.team_id != null && teams[comment.team_id]?.avatar_url ? (
          <img
            src={teams[comment.team_id]!.avatar_url!}
            alt=""
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : comment.user_id && profiles[comment.user_id]?.avatar_url ? (
          <img
            src={profiles[comment.user_id]!.avatar_url!}
            alt=""
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-white/10" />
        )}

        <div className="text-sm font-semibold">{nameOf(comment)}</div>
        <div className="text-xs text-[#9ca3af]">
          • {new Date(comment.created_at).toLocaleString('ru-RU', { hour12: false })}
        </div>

        <div className="ml-auto inline-flex items-center gap-3">
          {comment.is_team_comment && comment.is_pinned && (
            <span className="text-xs opacity-90 inline-flex items-center gap-1">
              <Pin className="w-5 h-5" /> Закреплено
            </span>
          )}
          <button
            onClick={() => onReply(comment.id)}
            className="inline-flex items-center gap-1 text-xs opacity-90 hover:opacity-100"
          >
            <CornerDownRight className="w-5 h-5" /> Ответить
          </button>
          <button
            onClick={() => onToggleLike(comment.id)}
            className="inline-flex items-center gap-1 text-xs opacity-90 hover:opacity-100"
          >
            <Heart
              className={`w-3.5 h-3.5 ${likedByMe[comment.id] ? 'fill-current' : ''}`}
            />
            <span className="tabular-nums">{likesCount[comment.id] ?? 0}</span>
          </button>
          {me && (
            <>
              <button
                onClick={() => startEdit(comment.id, comment.content)}
                className="inline-flex items-center gap-1 text-xs opacity-90 hover:opacity-100"
              >
                <Pencil className="w-3.5 h-3.5" /> Редактировать
              </button>
              <button
                onClick={() => onDelete(comment.id)}
                className="inline-flex items-center gap-1 text-xs opacity-90 hover:opacity-100"
              >
                <Trash2 className="w-3.5 h-3.5" /> Удалить
              </button>
            </>
          )}
        </div>
      </header>

      {/* Content or Editor */}
      {editingId === comment.id ? (
        <div className="mt-2">
          <div
            ref={editRef}
            contentEditable
            suppressContentEditableWarning
            className="min-h-[64px] rounded-lg p-3 outline-none bg-[#262626] text-[#e5e7eb] focus-visible:ring-2 ring-white/10"
          />
          <div className="mt-2 flex gap-2 justify-end">
            <button onClick={() => saveEdit(comment.id)} className={sendBtn}>
              Сохранить
            </button>
            <button
              onClick={() => {
                setEditingId(null);
                if (editRef.current) editRef.current.innerHTML = '';
              }}
              className="px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5"
            >
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <div
          className="mt-2 text-[15px] leading-relaxed break-words prose prose-sm max-w-none text-[#e5e7eb]"
          dangerouslySetInnerHTML={{ __html: comment.content }}
        />
      )}

      {/* Replies */}
      {replies.length > 0 && (
        <div className={replyBox}>
          <div className="space-y-3">
            {replies.map((reply) => {
              const mine = reply.user_id === userId;
              return (
                <div
                  key={reply.id}
                  className={`rounded-lg p-3 ${
                    reply.is_pinned ? 'bg-[#23272e] border border-[#39414f]' : 'bg-[#262626]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium">{nameOf(reply)}</div>
                    <div className="text-[11px] text-[#9ca3af]">
                      • {new Date(reply.created_at).toLocaleString('ru-RU', { hour12: false })}
                    </div>
                    <div className="ml-auto inline-flex items-center gap-3">
                      <button
                        onClick={() => onReply(comment.id)}
                        className="inline-flex items-center gap-1 text-[11px] opacity-90 hover:opacity-100"
                      >
                        <CornerDownRight className="w-3 h-3" /> Ответить
                      </button>
                      <button
                        onClick={() => onToggleLike(reply.id)}
                        className="inline-flex items-center gap-1 text-[11px] opacity-90 hover:opacity-100"
                      >
                        <Heart
                          className={`w-3 h-3 ${likedByMe[reply.id] ? 'fill-current' : ''}`}
                        />
                        <span className="tabular-nums">{likesCount[reply.id] ?? 0}</span>
                      </button>
                      {mine && (
                        <>
                          <button
                            onClick={() => startEdit(reply.id, reply.content)}
                            className="inline-flex items-center gap-1 text-[11px] opacity-90 hover:opacity-100"
                          >
                            <Pencil className="w-3 h-3" /> Редактировать
                          </button>
                          <button
                            onClick={() => onDelete(reply.id)}
                            className="inline-flex items-center gap-1 text-[11px] opacity-90 hover:opacity-100"
                          >
                            <Trash2 className="w-3 h-3" /> Удалить
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {editingId === reply.id ? (
                    <div className="mt-1">
                      <div
                        ref={editRef}
                        contentEditable
                        suppressContentEditableWarning
                        className="min-h-[64px] rounded-lg p-3 outline-none bg-[#262626] text-[#e5e7eb] focus-visible:ring-2 ring-white/10"
                      />
                      <div className="mt-2 flex gap-2 justify-end">
                        <button onClick={() => saveEdit(reply.id)} className={sendBtn}>
                          Сохранить
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            if (editRef.current) editRef.current.innerHTML = '';
                          }}
                          className="px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5"
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="mt-1 leading-relaxed break-words prose prose-sm max-w-none text-[#e5e7eb]"
                      dangerouslySetInnerHTML={{ __html: reply.content }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </article>
  );
}