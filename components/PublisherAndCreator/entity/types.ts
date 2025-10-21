// components/entity/types.ts
export type RoleKey =
  | 'author'
  | 'artist'
  | 'writer'
  | 'translator'
  | 'publisher'
  | string;

export type EntityLite = {
  id: string;
  handle: string;
  name: string;
  avatar_url?: string | null;
  banner_url?: string | null;
  bio?: string | null;
  created_at?: string | null;
  socials?: {
    x_url?: string | null;
    telegram?: string | null;
    vk_url?: string | null;
    site_url?: string | null;
  };
  roles?: RoleKey[] | null;
  entityType: 'creator' | 'publisher';
};

export type TitleLink = {
  id: number;
  slug?: string | null;
  title: string;
  cover_url?: string | null;
  roles?: RoleKey[];
  year?: number | null;
};
