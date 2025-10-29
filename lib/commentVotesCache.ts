// lib/commentVotesCache.ts
export type VoteVal = -1 | 0 | 1;

type PendingVote = {
  mangaId: number;
  value: VoteVal;
  ts: number; // на всякий
};

const KEY = 'mp_pending_comment_votes_v1';

function isClient() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function readStore(): Record<string, PendingVote> {
  if (!isClient()) return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw) as Record<string, PendingVote>;
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
}

function writeStore(obj: Record<string, PendingVote>) {
  if (!isClient()) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(obj));
  } catch {
    /* ignore quota */
  }
}

/** Положить голос в кэш (последний голос по commentId всегда побеждает) */
export function queueVote(mangaId: number, commentId: string, value: VoteVal) {
  const store = readStore();
  store[commentId] = { mangaId, value, ts: Date.now() };
  writeStore(store);
}

/** Забрать все отложенные голоса для конкретного тайтла */
export function getPendingForManga(mangaId: number): Map<string, VoteVal> {
  const s = readStore();
  const map = new Map<string, VoteVal>();
  for (const [cid, v] of Object.entries(s)) {
    if (v.mangaId === mangaId) map.set(cid, v.value);
  }
  return map;
}

/** Удалить один голос из кэша */
function drop(commentId: string) {
  const s = readStore();
  if (commentId in s) {
    delete s[commentId];
    writeStore(s);
  }
}

/** Применить кэш к уже загруженным комментариям (чтобы UI соответствовал локальному голосу) */
export function applyPendingVotes<T extends { id: string; score?: number | null; my_vote?: VoteVal | null }>(
  items: T[],
  mangaId: number
): T[] {
  const pending = getPendingForManga(mangaId);
  if (pending.size === 0) return items;

  return items.map((c) => {
    const p = pending.get(c.id);
    if (p == null) return c;

    const serverMy = (c.my_vote ?? 0) as VoteVal;
    const serverScore = Number(c.score ?? 0);
    const delta = (p as number) - serverMy;
    return {
      ...c,
      my_vote: p,
      score: serverScore + delta,
    };
  });
}

/** Отправить все отложенные голоса для манги. Ошедшие — удаляем из кэша, неуспешные — оставляем. */
export async function flushPending(mangaId: number) {
  if (!isClient()) return;

  const pending = getPendingForManga(mangaId);
  if (pending.size === 0) return;

  // Отправляем последнюю версию по каждому комменту
  await Promise.allSettled(
    Array.from(pending.entries()).map(async ([commentId, value]) => {
      try {
        const res = await fetch(`/api/manga/${mangaId}/comments/${commentId}/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ value }),
        });
        if (res.ok) drop(commentId);
        else {
          // 404 — коммент исчез, бессмысленно хранить
          if (res.status === 404) drop(commentId);
          // 401/403 — оставляем, может отправится позже после логина
        }
      } catch {
        // сеть упала — оставляем в кэше
      }
    })
  );
}
