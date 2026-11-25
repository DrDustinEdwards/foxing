export type ShelfStatus = "want" | "reading" | "finished" | "paused" | "abandoned";

export type Visibility = "private" | "friends" | "public";

export type ReactionTarget =
  | "annotation"
  | "club_post"
  | "club_thread"
  | "diary_entry"
  | "reading_list"
  | "journal_post";

export type AnnotationType = "highlight" | "note" | "bookmark" | "comment" | "commonplace";

export interface ProfileSummary {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface BookCard {
  id: string;
  slug: string;
  title: string;
  author: string;
  authorSlug: string | null;
  coverUrl: string | null;
  publicationYear: number | null;
  readable: boolean;
}

export interface BookRef {
  id: string;
  slug: string;
  title: string;
  author: string;
  coverUrl: string | null;
}
