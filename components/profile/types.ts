//components\profile\types.ts
export type Status = 'reading' | 'completed' | 'planned' | 'dropped' | null;

export type CardItem = {
  manga_id: number;
  title: string | null;
  cover_url: string | null;
  lang: string | null;
};

export type ActivityItem = {
  type: 'read' | 'completed' | 'favorited' | 'planned' | 'dropped';
  manga_id: number;
  manga_title: string;
  manga_cover: string | null;
  date: string;
};

export type LibraryRow = {
  status: Exclude<Status, null>;
  is_favorite?: boolean | null;
  favorite?: boolean | null;
  manga_id: number;
  updated_at?: string | null;
  created_at?: string | null;
  manga?: {
    id: number | string;
    title: string | null;
    cover_url: string | null;
    author?: string | null;
    artist?: string | null;
    status?: string | null;
  } | null;
};

export type ProfileLite = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string | null;
  banner_url: string | null;
  favorite_genres: string[] | null;
  telegram: string | null;
  x_url: string | null;
  vk_url: string | null;
  discord_url: string | null;
};

export type EditValues = {
  username: string;
  full_name: string;
  avatar_url: string;
  bio: string;
  banner_url: string;
  favorite_genres: string[];
  telegram: string;
  x_url: string;
  vk_url: string;
  discord_url: string;
};
