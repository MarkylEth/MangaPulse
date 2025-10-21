export type Manga = {
  id: number;
  title: string;
  cover_url?: string | null;
  author?: string | null;
  artist?: string | null;
  description?: string | null;
  status?: string | null;
  translation_status?: string | null;
  age_rating?: string | null;
  release_year?: number | null;
  rating?: number | null;
  rating_count?: number | null;
  original_title?: string | null;
  title_romaji?: string | null;
  type?: string | null;
  release_formats?: string[] | null;
  tags?: string[] | null;
  genres?: string[] | null;
};

export type Chapter = {
  id: number;
  manga_id: number;
  chapter_number: number;
  title?: string | null;
  created_at: string;
  status?: string | null;
  vol_number?: number | null;
};

export type Genre = { id: number | string; manga_id: number; genre: string };

export type Team = {
  id: number;
  name: string;
  slug?: string | null;
  avatar_url?: string | null;
  verified?: boolean | null;
};

export type RatingRow = { id: string; manga_id: number; rating: number; user_id?: string | null };

export type PersonLink = { id: number; name: string; slug?: string | null };
export type PublisherLink = { id: number; name: string; slug?: string | null };

export interface MangaTitlePageProps {
  mangaId: number;
  initialChapters?: Chapter[];
  isLoggedIn: boolean;
}

export type MeInfo = { id: string; username?: string | null; role?: string | null; leaderTeamId?: number | null } | null;

export type ChapterGroup = { vol: number | null; items: Chapter[] };
