// components/comments/CommentList.tsx
'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { CornerDownRight, Pin, Trash2, Flag, ChevronDown, ChevronUp } from 'lucide-react';
import ReportForm from '@/components/comments/ReportForm';

export type ProfileLite = { id: string; username?: string | null; avatar_url?: string | null } | null;
export type CommentRow = {
  id: string; manga_id: number; user_id: string | null; comment: string; created_at: string;
  parent_id?: string | null; is_team_comment?: boolean | null; team_id?: number | null;
  is_pinned?: boolean | null; profile?: ProfileLite;
  team?: { id: number; name: string; avatar_url?: string | null } | null;
  is_hidden?: boolean | null; reports_count?: number | null;
};

const REPORTS_HIDE_THRESHOLD = 5;
const ROOTS_PAGE = 15;
const INITIAL_REPLIES_SHOWN = 3;

/* ===== helpers ===== */
function profileHref(p?: ProfileLite): string {
  if (!p) return '/profile';
  const uname = p.username?.trim();
  if (uname) return `/profile/${encodeURIComponent(uname)}`;
  return `/profile/${encodeURIComponent(p.id)}`;
}

function timeShort(date: string) {
  try { return new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }); }
  catch { return ''; }
}

/* Модалка удаления */
function DeleteModal({
  open, onClose, onConfirm,
}: { open: boolean; onClose: () => void; onConfirm: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-sm rounded-2xl bg-white/85 dark:bg-[#0f1115]/85 backdrop-blur-xl border border-black/10 dark:border-white/10 p-6 shadow-[0_20px_80px_rgba(0,0,0,.55)] mx-4">
        <h3 className="text-lg font-semibold mb-2 text-black dark:text-white">Удалить комментарий?</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Комментарий и все его ответы будут удалены без возможности восстановления.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-sm font-medium transition-all"
          >
            Отмена
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className="px-4 py-2 rounded-xl bg-red-500/90 hover:bg-red-600 text-white text-sm font-medium transition-all"
          >
            Удалить
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===== Один ответ (подкомментарий) ===== */
const ReplyItem = React.memo(function ReplyItem({
  r, mangaId, me, onReply, onReportedLocally, canDelete, childrenMap, level = 1,
}: {
  r: CommentRow;
  mangaId: number;
  me: { id: string } | null;
  onReply: (id: string, username?: string) => void;
  onReportedLocally: (id: string, willHide: boolean) => void;
  canDelete: (c: CommentRow) => boolean;
  childrenMap: Record<string, CommentRow[]>;
  level?: number;
}) {
  const rHidden = Boolean(r.is_hidden) || Number(r.reports_count ?? 0) >= REPORTS_HIDE_THRESHOLD;
  const canDel = canDelete(r);
  const [showNestedReplies, setShowNestedReplies] = useState(true);

  const nestedReplies = (childrenMap[r.id] || [])
    .slice()
    .sort((a, b) => {
      const t = +new Date(a.created_at) - +new Date(b.created_at);
      if (t !== 0) return t;
      return String(a.id).localeCompare(String(b.id));
    });

  const hasNestedReplies = nestedReplies.length > 0;
  const maxNestingLevel = 3;

  return (
    <div className="group relative">
      <div className="relative flex items-start gap-2.5 py-2.5 transition-all duration-200">
        {/* Тонкая вертикальная линия слева */}
        <div className="absolute left-[17px] top-12 bottom-0 w-px bg-gradient-to-b from-blue-400/30 via-purple-400/20 to-transparent dark:from-blue-500/20 dark:via-purple-500/10" />

        <Link
          href={profileHref(r.profile)}
          className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 dark:from-blue-400/20 dark:to-purple-400/20 flex items-center justify-center text-xs overflow-hidden shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/30 hover:scale-105 hover:from-blue-500/20 hover:to-purple-500/20 transition-all"
          title={r.profile?.username ?? 'Профиль'}
        >
          {r.profile?.avatar_url
            ? <img src={r.profile.avatar_url} alt="avatar" className="h-full w-full object-cover" />
            : <span className="font-semibold text-gray-600 dark:text-gray-400">
                {r.profile?.username?.[0]?.toUpperCase() ?? '?'}
              </span>}
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={profileHref(r.profile)}
                className="text-[13px] font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {r.profile?.username ?? 'Пользователь'}
              </Link>
              <span className="text-[11px] text-gray-500 dark:text-gray-500">
                {timeShort(r.created_at)}
              </span>
            </div>

            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {!rHidden && me && level < 3 && (
                <button
                  onClick={() => onReply(r.id, r.profile?.username || undefined)}
                  className="p-1 rounded-md text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-500/5 transition-all"
                  title="Ответить"
                >
                  <CornerDownRight className="w-3.5 h-3.5" />
                </button>
              )}

              {(!me || (me && me.id !== r.user_id)) && (
                <ReportForm
                  mangaId={mangaId}
                  commentId={r.id}
                  loggedIn={!!me}
                  onDone={(hidden) =>
                    onReportedLocally(
                      r.id,
                      hidden || (Number(r.reports_count ?? 0) + 1) >= REPORTS_HIDE_THRESHOLD
                    )
                  }
                >
                  <button
                    className="p-1 rounded-md text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-500/5 transition-all"
                    aria-label="Жалоба"
                  >
                    <Flag className="w-3.5 h-3.5" />
                  </button>
                </ReportForm>
              )}
            </div>
          </div>

          {rHidden ? (
            <div className="mt-1 px-2.5 py-1.5 rounded-md bg-amber-50/50 dark:bg-amber-500/5 text-xs italic text-amber-700 dark:text-amber-400/80">
              Комментарий скрыт
            </div>
          ) : (
            <div
              className="text-[14px] leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word] max-w-full"
              dangerouslySetInnerHTML={{ __html: r.comment || '' }}
            />
          )}

          {hasNestedReplies && level < 3 && (
            <button
              onClick={() => setShowNestedReplies(!showNestedReplies)}
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              {showNestedReplies ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  Скрыть {nestedReplies.length} {nestedReplies.length === 1 ? 'ответ' : 'ответов'}
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  {nestedReplies.length} {nestedReplies.length === 1 ? 'ответ' : 'ответов'}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {hasNestedReplies && showNestedReplies && level < 3 && (
        <div className="ml-10 mt-1 space-y-0.5 border-l-2 border-black/5 dark:border-white/5 pl-1">
          {nestedReplies.map((nested) => (
            <ReplyItem
              key={nested.id}
              r={nested}
              mangaId={mangaId}
              me={me}
              onReply={onReply}
              onReportedLocally={onReportedLocally}
              canDelete={canDel ? () => true : canDelete}
              childrenMap={childrenMap}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export function CommentList({
  roots, childrenMap, me, canEdit, leaderTeamId, mangaId,
  onReply, onPinnedToggle, onDelete, onReportedLocally,
  externalLoadMore,
}: {
  roots: CommentRow[];
  childrenMap: Record<string, CommentRow[]>;
  me: { id: string } | null;
  canEdit: boolean;
  leaderTeamId: number | null;
  mangaId: number;
  onReply: (id: string, username?: string) => void;
  onPinnedToggle: (c: CommentRow) => void;
  onDelete: (c: CommentRow) => void;
  onReportedLocally: (id: string, willHide: boolean) => void;
  /** Если передано — используем серверную догрузку (cursor). Если нет — локальная. */
  externalLoadMore?: {
    visible: boolean;
    disabled?: boolean;
    onClick: () => void;
    label?: string;
  };
}) {
  const canTogglePin = (_c: CommentRow) => Boolean(canEdit || leaderTeamId);
  const canDeleteComment = (c: CommentRow) => Boolean((me?.id && c.user_id === me.id) || canEdit);
  const isOwnComment = (c: CommentRow) => !!(me?.id && c.user_id === me.id);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<CommentRow | null>(null);

  // Состояние для раскрытия/скрытия ответов для каждого комментария
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});

  // ===== ПАГИНАЦИЯ ПО КОРНЕВЫМ КОММЕНТАРИЯМ (клиентская) =====
  const [shown, setShown] = useState(ROOTS_PAGE);

  const prevCountRef = useRef<number>(roots.length);
  useEffect(() => {
    if (!externalLoadMore) {
      prevCountRef.current = roots.length;
      return;
    }

    const prev = prevCountRef.current;
    const curr = roots.length;
    if (curr > prev) {
      const delta = curr - prev; // сколько новых корней пришло (обычно 15)
      setShown((n) => Math.min(n + delta, curr));
    }
    prevCountRef.current = curr;
  }, [roots.length, externalLoadMore]);

  // общий отсортированный список корней
  const sortedRoots = useMemo(() => {
    return roots.slice().sort((a, b) => {
      const pa = a.is_pinned ? 1 : 0;
      const pb = b.is_pinned ? 1 : 0;
      if (pa !== pb) return pb - pa;
      const t = +new Date(b.created_at) - +new Date(a.created_at);
      if (t !== 0) return t;
      return String(b.id).localeCompare(String(a.id));
    });
  }, [roots]);

  const visibleRoots = useMemo(() => sortedRoots.slice(0, shown), [sortedRoots, shown]);
  const hasMore = sortedRoots.length > shown;
  const remainingRoots = Math.max(0, sortedRoots.length - shown);

  const toggleReplies = (commentId: string) => {
    setExpandedReplies(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }));
  };

  return (
    <>
      <DeleteModal
        open={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setCommentToDelete(null); }}
        onConfirm={() => { if (commentToDelete) onDelete(commentToDelete); }}
      />

      <div className="space-y-4">
        {roots.length === 0 && (
          <div className="text-center text-gray-500 dark:text-gray-500 py-16">
            Пока нет комментариев
          </div>
        )}

        {visibleRoots.map((c) => {
          const repliesAll = (childrenMap[c.id] || [])
            .slice()
            .sort((a, b) => {
              const t = +new Date(b.created_at) - +new Date(a.created_at);
              if (t !== 0) return t;
              return String(b.id).localeCompare(String(a.id));
            });

          const isHidden =
            Boolean(c.is_hidden) || Number(c.reports_count ?? 0) >= REPORTS_HIDE_THRESHOLD;

          const hasReplies = repliesAll.length > 0;
          const hasMoreThanInitial = repliesAll.length > INITIAL_REPLIES_SHOWN;
          const isExpanded = expandedReplies[c.id] ?? false;

          const displayedReplies = (hasMoreThanInitial && !isExpanded)
            ? repliesAll.slice(0, INITIAL_REPLIES_SHOWN)
            : repliesAll;

          return (
            <div
              key={c.id}
              className={`
                group py-4 px-2 transition-all
                ${c.is_pinned
                  ? 'bg-amber-50/50 dark:bg-amber-500/5 -mx-2 rounded-xl'
                  : 'hover:bg-black/[0.02] dark:hover:bg-white/[0.02] -mx-2 rounded-xl'
                }
              `}
            >
              {c.is_pinned && (
                <div className="mb-3 ml-2">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium
                               text-amber-700 dark:text-amber-400"
                  >
                    <Pin className="w-3 h-3" />
                    Закреплено
                  </span>
                </div>
              )}

              <div className="flex items-start gap-3 px-2">
                <Link
                  href={profileHref(c.profile)}
                  className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 dark:from-blue-400/20 dark:to-purple-400/20 flex items-center justify-center overflow-hidden shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/30 hover:scale-105 transition-transform"
                  title={c.profile?.username ?? 'Профиль'}
                >
                  {c.profile?.avatar_url
                    ? <img src={c.profile.avatar_url} alt="avatar" className="h-full w-full object-cover" />
                    : <span className="font-semibold text-gray-600 dark:text-gray-400 text-sm">
                        {c.profile?.username?.[0]?.toUpperCase() ?? '?'}
                      </span>}
                </Link>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <Link
                        href={profileHref(c.profile)}
                        className="font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        {c.profile?.username ?? 'Пользователь'}
                      </Link>
                      <span className="text-xs text-gray-500 dark:text-gray-500">
                        {timeShort(c.created_at)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!isHidden && me && (
                        <button
                          onClick={() => onReply(c.id, c.profile?.username || undefined)}
                          className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-500/5 transition-all"
                          title="Ответить"
                        >
                          <CornerDownRight className="w-4 h-4" />
                        </button>
                      )}

                      {!isOwnComment(c) && (
                        <ReportForm
                          mangaId={mangaId}
                          commentId={c.id}
                          loggedIn={!!me}
                          onDone={(hidden) =>
                            onReportedLocally(
                              c.id,
                              hidden || (Number(c.reports_count ?? 0) + 1) >= REPORTS_HIDE_THRESHOLD
                            )
                          }
                        >
                          <button
                            className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-500/5 transition-all"
                            aria-label="Жалоба"
                          >
                            <Flag className="w-4 h-4" />
                          </button>
                        </ReportForm>
                      )}

                      {canTogglePin(c) && (
                        <button
                          onClick={() => onPinnedToggle(c)}
                          className={`p-1.5 rounded-lg transition-all ${
                            c.is_pinned
                              ? 'text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-500/10'
                              : 'text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-500/5'
                          }`}
                          title={c.is_pinned ? 'Открепить' : 'Закрепить'}
                        >
                          <Pin className="w-4 h-4" />
                        </button>
                      )}

                      {canDeleteComment(c) && (
                        <button
                          onClick={() => { setCommentToDelete(c); setDeleteModalOpen(true); }}
                          className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-500/5 transition-all"
                          title="Удалить"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {isHidden ? (
                    <div className="px-3 py-2 rounded-lg bg-amber-50/50 dark:bg-amber-500/5 text-xs italic text-amber-700 dark:text-amber-400/80">
                      Комментарий скрыт из-за жалоб
                    </div>
                  ) : (
                    <div
                      className="text-[15px] leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word] max-w-full"
                      dangerouslySetInnerHTML={{ __html: c.comment || '' }}
                    />
                  )}

                  {/* ====== Ответы ====== */}
                  {hasReplies && (
                    <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5 space-y-1.5">
                      {displayedReplies.map((r) => (
                        <ReplyItem
                          key={r.id}
                          r={r}
                          mangaId={mangaId}
                          me={me}
                          onReply={onReply}
                          onReportedLocally={onReportedLocally}
                          canDelete={canDeleteComment}
                          childrenMap={childrenMap}
                          level={1}
                        />
                      ))}
                    </div>
                  )}

                  {/* ====== Кнопка раскрытия ответов ====== */}
                  {hasReplies && hasMoreThanInitial && (
                    <div className="mt-2.5">
                      <button
                        onClick={() => toggleReplies(c.id)}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-3.5 h-3.5" />
                            Скрыть ответы
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3.5 h-3.5" />
                            Показать все {repliesAll.length} {repliesAll.length === 1 ? 'ответ' : repliesAll.length < 5 ? 'ответа' : 'ответов'}
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* ЕДИНАЯ КНОПКА: если проброшен externalLoadMore — используем серверную догрузку, иначе локальную */}
        {externalLoadMore ? (
          externalLoadMore.visible && (
            <div className="flex justify-center pt-1 pb-4">
              <button
                disabled={externalLoadMore.disabled}
                onClick={externalLoadMore.onClick}
                className="inline-flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-medium
                           border border-black/10 dark:border-white/10
                           bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10
                           text-gray-800 dark:text-gray-200 transition disabled:opacity-60"
              >
                {externalLoadMore.label ?? 'Загрузить ещё'}
              </button>
            </div>
          )
        ) : (
          hasMore && (
            <div className="flex justify-center pt-1 pb-4">
              <button
                onClick={() => setShown((n) => n + ROOTS_PAGE)}
                className="inline-flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-medium
                           border border-black/10 dark:border-white/10
                           bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10
                           text-gray-800 dark:text-gray-200 transition"
              >
                Загрузить ещё
              </button>
            </div>
          )
        )}
      </div>
    </>
  );
}
