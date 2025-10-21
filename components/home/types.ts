// components/home/types.ts
export type MangaApiRow = {
  id: number|string; title: string; cover_url?: string|null; status?: string|null;
  rating?: number|null; rating10?: number|null;
  chapters?: number|null; chapters_count?: number|null;
  genres?: string[]|string|null; genres2?: string[]|string|null;
  release_year?: number|null; release_date?: string|null;
  created_at?: string|null; manga_created_at?: string|null;
  first_chapter_at?: string|null; last_chapter_at?: string|null; last_event_at?: string|null; newness_at?: string|null;
};

export type Manga = {
  id:number|string; title:string; cover_url?:string|null; status?:string|null;
  rating:number; chapters_count:number; genres?:string[]; year:number; created_at_iso?:string|null; author?:string|null;
};

export type ChapterFeedItem = {
  chapter_id:string|number; manga_id:string|number; manga_title:string;
  chapter_number?:string|number|null; volume?:string|number|null; created_at:string;
  cover_url?:string|null; team_name?:string|null; team_slug?:string|null;
};

export type TeamNewsItem = {
  id: number; title: string; body: string; pinned: boolean; created_at: string; author_id: string;
  author_name?: string | null;
};

/** элементы карусели баннеров */
export type CarouselItem = {
  id: number | string;
  title: string;
  coverUrl: string;   // фон баннера
  href: string;       // CTA "Читать"

  // опциональные поля, которые использует HeroCarousel
  detailsHref?: string; // ссылка "Подробнее"
  badge?: string;       // ярлык (Новинка/Эксклюзив и т.п.)
  subtitle?: string;    // подзаголовок
};