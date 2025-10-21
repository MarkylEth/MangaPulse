// lib/navigation/openMangaOrBookmark.ts
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

function slugify(s?: string | null) {
  if (!s) return '';
  const from = 'а-аБ-бВ-вГ-гД-дЕ-еЁ-ёЖ-жЗ-зИ-иЙ-йК-кЛ-лМ-мН-нО-оП-пР-рС-сТ-тУ-уФ-фХ-хЦ-цЧ-чШ-шЩ-щЪ-ъЫ-ыЬ-ьЭ-эЮ-юЯ-я'.split('-');
  const to = 'a-aB-bV-vG-gD-dE-eE-eZh-zhZ-zI-iY-yK-kL-lM-mN-nO-oP-pR-rS-sT-tU-uF-fKh-khTs-tsCh-chSh-shSch-schIe-ieY-ySoft-softE-eYu-yuYa-ya'.split('-');
  let out = s.trim().toLowerCase();
  from.forEach((ch, i) => { out = out.replaceAll(ch, to[i].toLowerCase()); });
  return out
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function openMangaOrBookmark(
  router: AppRouterInstance,
  mangaId: number,
  title?: string | null
) {
  const slug = slugify(title);
  const base = slug ? `/title/${mangaId}-${slug}` : `/title/${mangaId}`;

  try {
    const res = await fetch(
      `/api/reader/bookmarks/by-manga/${encodeURIComponent(String(mangaId))}`,
      { credentials: 'include', cache: 'no-store' }
    );

    if (!res.ok) {
      router.push(base);
      return;
    }

    const j = await res.json().catch(() => null);
    if (!j?.ok || !j.item?.chapter_id) {
      router.push(base);
      return;
    }

    const chapterId = Number(j.item.chapter_id);
    const page = j.item.page != null && Number(j.item.page) > 0 ? Number(j.item.page) : 1;

    try {
      const chRes = await fetch(`/api/chapters/${chapterId}`, { cache: 'no-store' });
      const chJson = await chRes.json().catch(() => null);

      const info = chJson?.item || chJson || {};
      const volRaw = info?.volume_index ?? info?.vol ?? null;
      const chRaw = info?.chapter_number ?? info?.number ?? info?.chapter ?? null;

      const toNumStr = (v: any) => {
        if (v == null) return null;
        const n = Number(v);
        if (!Number.isFinite(n)) return String(v);
        return Number.isInteger(n) ? String(n) : String(n).replace(/\.0+$/, '');
      };

      const volStr = toNumStr(volRaw);
      const chStr = toNumStr(chRaw);

      if (volStr != null && chStr != null) {
        router.push(`${base}/v/${encodeURIComponent(volStr)}/c/${encodeURIComponent(chStr)}/p/${page}`);
        return;
      }

      router.push(`${base}/chapter/${chapterId}`);
    } catch {
      router.push(`${base}/chapter/${chapterId}`);
    }
  } catch {
    router.push(base);
  }
}