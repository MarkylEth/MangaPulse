// components/comments/CommentList.tsx
'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  CornerDownRight,
  Pin,
  Trash2,
  Flag,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import ReportForm from '@/components/comments/ReportForm';
import { convertSpoilers } from './CommentEditor';

/* ===================== Types ===================== */
export type ProfileLite = {
  id: string;
  username?: string | null;
  avatar_url?: string | null;
} | null;

export type CommentRow = {
  id: string;
  manga_id: number;
  user_id: string | null;
  comment: string;
  created_at: string;
  parent_id?: string | null;
  is_team_comment?: boolean | null;
  team_id?: number | null;
  is_pinned?: boolean | null;
  profile?: ProfileLite;
  team?: { id: number; name: string; avatar_url?: string | null } | null;
  is_hidden?: boolean | null;
  reports_count?: number | null;
  score?: number | null;
  my_vote?: -1 | 0 | 1 | null;
};

/* ========= Компоновка / Ветки ========= */
const WRAP_AFTER = 8;                 // после этого уровня начинаем новую «ветку»
const INDENT_UNIT_PX = 21;            // шаг смещения одного уровня
const MAX_VISUAL_LEVEL = 28;          // максимум визуального уровня
const MIN_CONTENT_PX = 520;           // не ужимаем контент в «полоску»
const COMMENTS_MAX_WIDTH = 880;       // ширина блока комментариев

const REPORTS_HIDE_THRESHOLD = 5;
const ROOTS_PAGE = 15;
const INITIAL_REPLIES_SHOWN = 3;

type SortMode = 'popular' | 'new' | 'old';

/* ===================== Utils ===================== */
function profileHref(p?: ProfileLite): string {
  if (!p) return '/profile';
  const uname = p.username?.trim();
  if (uname) return `/profile/${encodeURIComponent(uname)}`;
  return `/profile/${encodeURIComponent(p.id)}`;
}

function timeShort(date: string) {
  try {
    return new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

const sortAsc = (a: CommentRow, b: CommentRow) => {
  const t = +new Date(a.created_at) - +new Date(b.created_at);
  return t !== 0 ? t : String(a.id).localeCompare(String(b.id));
};

/* ========= Голосовалка ========= */
function VoteBar({
  score = 0,
  my = 0,
  onUp,
  onDown,
  disabled,
}: {
  score?: number | null;
  my?: -1 | 0 | 1 | null;
  onUp: () => void;
  onDown: () => void;
  disabled?: boolean;
}) {
  const mine = my ?? 0;
  const isUp = mine === 1;
  const isDown = mine === -1;
  const commonBtn =
    'p-1 rounded-md transition-all hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed';
  return (
    <div className="inline-flex items-center gap-1 text-xs font-medium select-none">
      <button
        className={`${commonBtn} ${isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}
        onClick={onUp}
        disabled={disabled}
        title="Нравится"
        aria-label="Нравится"
      >
        <ArrowUp className="w-3.5 h-3.5" />
      </button>
      <span className="min-w-[1.25rem] text-center text-gray-700 dark:text-gray-300">
        {score ?? 0}
      </span>
      <button
        className={`${commonBtn} ${isDown ? 'text-rose-600 dark:text-rose-400' : 'text-gray-500 dark:text-gray-400'}`}
        onClick={onDown}
        disabled={disabled}
        title="Не нравится"
        aria-label="Не нравится"
      >
        <ArrowDown className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/* ========= Модалка удаления ========= */
function DeleteModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-sm rounded-2xl bg-white/85 dark:bg-[#0f1115]/85 backdrop-blur-xl border border-black/10 dark:border-white/10 p-6 shadow-[0_20px_80px_rgba(0,0,0,.55)] mx-4">
        <h3 className="text-lg font-semibold mb-2 text-black dark:text-white">Точно удаляем?</h3>
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
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-red-500/90 hover:bg-red-600 text-white text-sm font-medium transition-all"
          >
            Удалить
          </button>
        </div>
      </div>
    </div>
  );
}

/* ========= Один ответ (строка) ========= */
const ReplyItem = React.memo(function ReplyItem({
  r,
  mangaId,
  me,
  onReply,
  onReportedLocally,
  canDelete,
  childrenMap,
  level = 1,
  onVote,
  onAskDelete,
}: {
  r: CommentRow;
  mangaId: number;
  me: { id: string } | null;
  onReply: (id: string, username?: string) => void;
  onReportedLocally: (id: string, willHide: boolean) => void;
  canDelete: (c: CommentRow) => boolean;
  childrenMap: Record<string, CommentRow[]>;
  level?: number;
  onVote: (id: string, next: -1 | 0 | 1) => void;
  onAskDelete: (c: CommentRow) => void;
}) {
  const rHidden =
    Boolean(r.is_hidden) || Number(r.reports_count ?? 0) >= REPORTS_HIDE_THRESHOLD;
  const canDel = canDelete(r);

  const my = (r.my_vote ?? 0) as -1 | 0 | 1;
  const score = r.score ?? 0;

  // Локальный уровень внутри сегмента: 1..MAX_VISUAL_LEVEL
  const depth = Math.max(1, Math.min(level, MAX_VISUAL_LEVEL));

  // Сдвиг ВЕСЬ РЯД (аватар + контент)
  const rowIndentPx = (depth - 1) * INDENT_UNIT_PX;

  // Внутренний гуттер не используем
  const cssVars = { ['--gutter' as any]: '0px' } as React.CSSProperties;

  const nestedReplies = (childrenMap[r.id] || []).slice().sort(sortAsc);
  const hasNestedReplies = nestedReplies.length > 0;

  // ---- ВИЗУАЛЬНЫЕ ПОЛОСЫ ----
  const guidesCount = Math.max(0, depth - 1);
  const lineXs = Array.from({ length: guidesCount }, (_, i) => (i + 0.5) * INDENT_UNIT_PX);
  const elbowY = 16; // высота «полки» от верха строки

  return (
    <div className="group relative max-w-full">
      <div
        className="relative flex items-start gap-2.5 py-2.5"
        style={{ marginLeft: rowIndentPx ? `${rowIndentPx}px` : undefined }}
      >
        {/* ===== Полосы внутри зоны отступа (левее всей строки) ===== */}
        {rowIndentPx > 0 && (
          <div
            className="pointer-events-none absolute inset-y-0"
            style={{ left: `-${rowIndentPx}px`, width: `${rowIndentPx}px` }}
            aria-hidden="true"
          >
            {lineXs.map((x) => (
              <div
                key={x}
                className="absolute top-0 bottom-0 border-l border-black/10 dark:border-white/10"
                style={{ left: `${x}px` }}
              />
            ))}
          </div>
        )}

        {/* Аватар */}
        <Link
          href={profileHref(r.profile)}
          className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 dark:from-blue-400/20 dark:to-purple-400/20 flex items-center justify-center text-xs overflow-hidden shrink-0 hover:scale-105 transition-all"
          title={r.profile?.username ?? 'Профиль'}
        >
          {r.profile?.avatar_url ? (
            <img src={r.profile.avatar_url} alt="avatar" className="h-full w-full object-cover" />
          ) : (
            <span className="font-semibold text-gray-600 dark:text-gray-400">
              {r.profile?.username?.[0]?.toUpperCase() ?? '?'}
            </span>
          )}
        </Link>

        {/* Контент строки */}
        <div className="relative flex-1 min-w-0">
          {/* Небольшая «полка» к тексту (визуально соединяет с полосой) */}
          {rowIndentPx > 0 && (
            <div
              className="pointer-events-none absolute border-t border-black/10 dark:border-white/10"
              style={{ left: '-10px', top: `${elbowY}px`, width: '10px' }}
              aria-hidden="true"
            />
          )}

          {/* Шапка */}
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

              <div className="ml-1">
                <VoteBar
                  score={score}
                  my={my}
                  onUp={() => onVote(r.id, (my === 1 ? 0 : 1) as 1 | 0)}
                  onDown={() => onVote(r.id, (my === -1 ? 0 : -1) as -1 | 0)}
                  disabled={!me}
                />
              </div>
            </div>

            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {!rHidden && me && (
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
                  source="manga"
                  targetId={mangaId}
                  commentId={r.id}
                  loggedIn={!!me}
                  onDone={(hidden) =>
                    onReportedLocally(
                      r.id,
                      hidden || (Number(r.reports_count ?? 0) + 1) >= REPORTS_HIDE_THRESHOLD,
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
              {canDel && (
                <button
                  onClick={() => onAskDelete(r)}
                  className="p-1 rounded-md text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-500/5 transition-all"
                  title="Удалить"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Текст */}
          <div
            className="w-full min-w-0 inline-grid"
            style={{ ...cssVars, gridTemplateColumns: 'var(--gutter) 1fr', alignItems: 'start' }}
          >
            <div aria-hidden="true" />
            <div className="min-w-0">
              {rHidden ? (
                <div className="mt-1 px-2.5 py-1.5 rounded-md bg-amber-50/50 dark:bg-amber-500/5 text-xs italic text-amber-700 dark:text-amber-400/80">
                  Комментарий скрыт
                </div>
              ) : (
                <div
                  className="text-[14px] leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word] max-w-full"
                  dangerouslySetInnerHTML={{ __html: convertSpoilers(r.comment || '') }}
                />
              )}

              {/* БЕЗ локальной свернулки — просто рисуем детей (если они есть) */}
              {hasNestedReplies &&
                nestedReplies.map((nested) => (
                  <ReplyItem
                    key={nested.id}
                    r={nested}
                    mangaId={mangaId}
                    me={me}
                    onReply={onReply}
                    onReportedLocally={onReportedLocally}
                    canDelete={canDelete}
                    childrenMap={childrenMap}
                    level={level + 1}
                    onVote={onVote}
                    onAskDelete={onAskDelete}
                  />
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

/* ========= Список ========= */
export function CommentList({
  roots,
  childrenMap,
  me,
  canEdit,
  leaderTeamId,
  mangaId,
  onReply,
  onPinnedToggle,
  onDelete,
  onReportedLocally,
  externalLoadMore,
  sortMode = 'popular',
  onVote,
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
  externalLoadMore?: {
    visible: boolean;
    disabled?: boolean;
    onClick: () => void;
    label?: string;
  };
  sortMode?: SortMode;
  onVote: (id: string, next: -1 | 0 | 1) => void;
}) {
  const canTogglePin = (_c: CommentRow) => Boolean(canEdit || leaderTeamId);
  const canDeleteComment = (c: CommentRow) =>
    Boolean((me?.id && c.user_id === me.id) || canEdit);
  const isOwnComment = (c: CommentRow) => !!(me?.id && c.user_id === me.id);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<CommentRow | null>(null);

  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [hiddenReplies, setHiddenReplies] = useState<Record<string, boolean>>({}); // ⬅️ глобальное скрытие ответов (только под корнем)
  const [shown, setShown] = useState(ROOTS_PAGE);

  const prevCountRef = useRef<number>(roots.length);

  const askDelete = React.useCallback((c: CommentRow) => {
    setCommentToDelete(c);
    setDeleteModalOpen(true);
  }, []);

  /* управление спойлерами */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest?.('.spoiler-blur') as HTMLElement | null;
      if (!target) return;
      if (window.getSelection()?.toString()) return;
      e.preventDefault();
      const revealed = target.classList.toggle('revealed');
      target.setAttribute('aria-pressed', revealed ? 'true' : 'false');
    };

    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (!el.classList?.contains('spoiler-blur')) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const revealed = el.classList.toggle('revealed');
        el.setAttribute('aria-pressed', revealed ? 'true' : 'false');
      }
    };

    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  /* автоподгрузка счётчика показа при добавлении извне */
  useEffect(() => {
    if (!externalLoadMore) {
      prevCountRef.current = roots.length;
      return;
    }
    const prev = prevCountRef.current;
    const curr = roots.length;
    if (curr > prev) setShown((n) => Math.min(n + (curr - prev), curr));
    prevCountRef.current = curr;
  }, [roots.length, externalLoadMore]);

  const sortedRoots = useMemo(() => {
    const arr = roots.slice();
    arr.sort((a, b) => {
      const pa = a.is_pinned ? 1 : 0;
      const pb = b.is_pinned ? 1 : 0;
      if (pa !== pb) return pb - pa;

      if (sortMode === 'popular') {
        const sa = Number(a.score ?? 0);
        const sb = Number(b.score ?? 0);
        if (sa !== sb) return sb - sa;
        const ta = +new Date(b.created_at) - +new Date(a.created_at);
        if (ta !== 0) return ta;
        return String(b.id).localeCompare(String(a.id));
      }
      if (sortMode === 'old') {
        const t = +new Date(a.created_at) - +new Date(b.created_at);
        if (t !== 0) return t;
        return (a.score ?? 0) - (b.score ?? 0);
      }
      const t = +new Date(b.created_at) - +new Date(a.created_at);
      if (t !== 0) return t;
      return (b.score ?? 0) - (a.score ?? 0);
    });
    return arr;
  }, [roots, sortMode]);

  const visibleRoots = useMemo(() => sortedRoots.slice(0, shown), [sortedRoots, shown]);
  const hasMore = sortedRoots.length > shown;

  const toggleReplies = (commentId: string) => {
    setExpandedReplies((prev) => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  /* ---------- Хелперы для сегментации ---------- */
  type FlatItem = { node: CommentRow; localLevel: number; segment: number };

  const sortChildrenAsc = (arr: CommentRow[]) => arr.slice().sort(sortAsc);

  function flattenToSegments(startNodes: CommentRow[], map: Record<string, CommentRow[]>) {
    const out: FlatItem[] = [];

    function dfs(n: CommentRow, level: number) {
      // level: 1 — первый ответ под корневым
      const segment = Math.floor((level - 1) / WRAP_AFTER);
      const localLevel = ((level - 1) % WRAP_AFTER) + 1;
      out.push({ node: n, localLevel, segment });

      const kids = sortChildrenAsc(map[n.id] || []);
      for (const k of kids) dfs(k, level + 1);
    }

    for (const top of sortChildrenAsc(startNodes)) dfs(top, 1);
    return out;
  }

  return (
    <>
      <DeleteModal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setCommentToDelete(null);
        }}
        onConfirm={() => {
          if (commentToDelete) onDelete(commentToDelete);
        }}
      />

      {/* Центрированный контейнер фикс-ширины */}
      <div className="w-full flex justify-center">
        <div
          className="space-y-4 w-full overflow-x-hidden"
          style={{ maxWidth: `${COMMENTS_MAX_WIDTH}px` }}
        >
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
            const areHidden = hiddenReplies[c.id] ?? false;

            const displayedReplies =
              areHidden
                ? []
                : hasMoreThanInitial && !isExpanded
                ? repliesAll.slice(0, INITIAL_REPLIES_SHOWN)
                : repliesAll;

            const my = (c.my_vote ?? 0) as -1 | 0 | 1;
            const score = c.score ?? 0;

            return (
              <div
                key={c.id}
                className={`group py-4 px-2 transition-all rounded-xl overflow-hidden ${
                  c.is_pinned
                    ? 'bg-amber-50/50 dark:bg-amber-500/5'
                    : 'hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
                }`}
              >
                {c.is_pinned && (
                  <div className="mb-3 ml-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-amber-700 dark:text-amber-400">
                      <Pin className="w-3 h-3" />
                      Закреплено
                    </span>
                  </div>
                )}

                <div className="flex items-start gap-3 px-2">
                  <Link
                    href={profileHref(c.profile)}
                    className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 dark:from-blue-400/20 dark:to-purple-400/20 flex items-center justify-center overflow-hidden shrink-0 hover:scale-105 transition-transform"
                    title={c.profile?.username ?? 'Профиль'}
                  >
                    {c.profile?.avatar_url ? (
                      <img src={c.profile.avatar_url} alt="avatar" className="h-full w-full object-cover" />
                    ) : (
                      <span className="font-semibold text-gray-600 dark:text-gray-400 text-sm">
                        {c.profile?.username?.[0]?.toUpperCase() ?? '?'}
                      </span>
                    )}
                  </Link>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <Link
                          href={profileHref(c.profile)}
                          className="font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          {c.profile?.username ?? 'Пользователь'}
                        </Link>
                        <span className="text-xs text-gray-500 dark:text-gray-500">
                          {timeShort(c.created_at)}
                        </span>
                        <div className="ml-1 shrink-0">
                          <VoteBar
                            score={score}
                            my={my}
                            onUp={() => onVote(c.id, my === 1 ? 0 : 1)}
                            onDown={() => onVote(c.id, my === -1 ? 0 : -1)}
                            disabled={!me}
                          />
                        </div>
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
                            source="manga"
                            targetId={mangaId}
                            commentId={c.id}
                            loggedIn={!!me}
                            onDone={(hidden) =>
                              onReportedLocally(
                                c.id,
                                hidden || (Number(c.reports_count ?? 0) + 1) >= REPORTS_HIDE_THRESHOLD,
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
                            onClick={() => askDelete(c)}
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
                        className="!block w-full max-w-none text-[15px] leading-relaxed
                                   text-gray-800 dark:text-gray-200
                                   whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word]
                                   !pl-0 !ml-0"
                        style={{ textIndent: 0 }}
                        dangerouslySetInnerHTML={{ __html: convertSpoilers(c.comment || '') }}
                      />
                    )}

                    {/* Ответы: сегменты по WRAP_AFTER уровней — НЕ рисуем, если скрыты */}
                    {hasReplies && !areHidden && (
                      <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5">
                        {(() => {
                          // плоский список с расчётом сегментов
                          type FlatItem = { node: CommentRow; localLevel: number; segment: number };
                          const flat: FlatItem[] = (function flatten(startNodes: CommentRow[]) {
                            const out: FlatItem[] = [];
                            function dfs(n: CommentRow, level: number) {
                              const segment = Math.floor((level - 1) / WRAP_AFTER);
                              const localLevel = ((level - 1) % WRAP_AFTER) + 1;
                              out.push({ node: n, localLevel, segment });
                              const kids = (childrenMap[n.id] || []).slice().sort(sortAsc);
                              for (const k of kids) dfs(k, level + 1);
                            }
                            for (const top of startNodes.slice().sort(sortAsc)) dfs(top, 1);
                            return out;
                          })(displayedReplies);

                          // группируем по сегментам
                          const bySeg = new Map<number, FlatItem[]>();
                          for (const it of flat) {
                            if (!bySeg.has(it.segment)) bySeg.set(it.segment, []);
                            bySeg.get(it.segment)!.push(it);
                          }

                          // пустая мапа — чтобы ReplyItem не рисовал детей повторно
                          const emptyChildren: Record<string, CommentRow[]> = {};

                          return [...bySeg.keys()]
                            .sort((a, b) => a - b)
                            .map((segIdx) => {
                              const items = bySeg.get(segIdx)!;

                              return (
                                <div
                                  key={`seg-${c.id}-${segIdx}`}
                                  className={`${segIdx > 0 ? 'mt-4 pt-2' : 'mt-1'} pl-3 border-l border-black/10 dark:border-white/10 rounded-sm`}
                                >
                                  {items.map(({ node, localLevel }) => (
                                    <ReplyItem
                                      key={node.id}
                                      r={node}
                                      mangaId={mangaId}
                                      me={me}
                                      onReply={onReply}
                                      onReportedLocally={onReportedLocally}
                                      canDelete={canDeleteComment}
                                      childrenMap={emptyChildren}
                                      level={localLevel}
                                      onVote={onVote}
                                      onAskDelete={askDelete}
                                    />
                                  ))}
                                </div>
                              );
                            });
                        })()}
                      </div>
                    )}

                    {/* Кнопки управления ответами — только под корневым */}
                    {hasReplies && (
                      <div className="mt-2.5 flex items-center gap-3">
                        {/* Основная: показать/скрыть все ответы */}
                        <button
                          onClick={() =>
                            setHiddenReplies(prev => ({ ...prev, [c.id]: !areHidden }))
                          }
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          {areHidden ? (
                            <>
                              <ChevronDown className="w-3.5 h-3.5" />
                              Показать {repliesAll.length}{' '}
                              {repliesAll.length === 1 ? 'ответ' : repliesAll.length < 5 ? 'ответа' : 'ответов'}
                            </>
                          ) : (
                            <>
                              <ChevronUp className="w-3.5 h-3.5" />
                              Скрыть ответы
                            </>
                          )}
                        </button>

                        {/* Вторичная: раскрыть все / свернуть до INITIAL_REPLIES_SHOWN (только когда не скрыты) */}
                        {hasMoreThanInitial && !areHidden && (
                          <button
                            onClick={() => toggleReplies(c.id)}
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="w-3.5 h-3.5" />
                                Свернуть до {INITIAL_REPLIES_SHOWN}
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-3.5 h-3.5" />
                                Показать все {repliesAll.length}{' '}
                                {repliesAll.length === 1 ? 'ответ' : repliesAll.length < 5 ? 'ответа' : 'ответов'}
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

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
      </div>
    </>
  );
}
