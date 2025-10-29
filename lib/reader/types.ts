// lib/reader/types.ts

export type Page = {
    id: number;
    chapter_id: number;
    index: number;
    url: string;
    width?: number | null;
    height?: number | null;
    volume_index?: number | null;
  };
  
  export type ChapterMeta = {
    id?: number | string | null;
    manga_id?: number | string | null;
    chapter_number?: number | string | null;
    vol?: number | string | null;
    title?: string | null;
  };
  
  export type TeamInfo = {
    id?: number | null;
    name?: string | null;
    slug?: string | null;
    avatar_url?: string | null;
    verified?: boolean | null;
  };
  
  export type PageComment = {
    id: string;
    page_id: number;
    chapter_id: number;
    user_id: string | null;
    created_at: string;
    content: string;
    parent_id?: string | null;
    is_team_comment?: boolean | null;
    team_id?: number | null;
    is_pinned?: boolean | null;
    likes_count?: number | null;
    is_edited?: boolean | null;
    edited_at?: string | null;
  };
  
  export type Profile = {
    username?: string | null;
    avatar_url?: string | null;
  };
  
  export type Team = {
    name?: string | null;
    avatar_url?: string | null;
  };
  
  export type SortMode = 'new' | 'old' | 'top';
  
  export type ChapterReaderProps =
    | {
        chapterId: number | string;
        mangaId?: never;
        vol?: never;
        chapter?: never;
        page?: never;
      }
    | {
        chapterId?: never;
        mangaId: number | string;
        vol: number | string | 'none';
        chapter: number | string;
        page?: number | string;
      };