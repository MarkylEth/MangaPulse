import { asList } from '@/lib/asList';
import type { MangaApiRow, Manga } from '@/components/home/types';

const toNumber = (v: unknown, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

export function mapMangaRows(rows?: MangaApiRow[]|null): Manga[] {
  if (!rows) return [];
  return rows.map((item) => {
    const rating10 =
      typeof item.rating10 === 'number'
        ? item.rating10
        : typeof item.rating === 'number'
          ? (item.rating <= 5 ? item.rating * 2 : item.rating)
          : 0;

    const genresArr = Array.isArray(item.genres)
      ? item.genres.map(String)
      : asList(item.genres ?? item.genres2 ?? null);

    const createdAtStr =
      (item as any).newness_at ??
      (item as any).created_at ??
      (item as any).manga_created_at ??
      (item as any).first_chapter_at ??
      (item as any).release_date ??
      null;

    const y = typeof item.release_year === 'number'
      ? item.release_year
      : createdAtStr
        ? new Date(String(createdAtStr)).getFullYear()
        : new Date().getFullYear();

    return {
      id: item.id,
      title: item.title ?? 'Без названия',
      cover_url: item.cover_url ?? null,
      status: item.status ?? undefined,
      rating: toNumber(rating10, 0),
      chapters_count: toNumber(item.chapters_count ?? item.chapters, 0),
      genres: genresArr,
      year: Number.isFinite(y) ? y : new Date().getFullYear(),
      created_at_iso: createdAtStr ? String(createdAtStr) : null,
      author: (item as any).author ?? (item as any).author_name ?? null,
    };
  });
}
