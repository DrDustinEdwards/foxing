import type { AnnotationType } from "./common";

/** A reading position (Readium locator JSON); the server stores it as given. */
export type Locator = Record<string, unknown>;

/** Two independent, OR-combined reasons to collapse another reader's annotation:
 *  their manual spoiler flag, and it being ahead of where the viewer has read. */
export interface Gate {
  spoiler: boolean;
  ahead: boolean;
}

export type OtherLayer = "club" | "friend" | "public";

export interface AnnotationAuthor {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface ReaderMine {
  id: string;
  type: string;
  locator: Locator | null;
  selectedText: string | null;
  body: string | null;
  color: string | null;
  chapter: string | null;
}

export interface ResolvedOther extends ReaderMine {
  layer: OtherLayer;
  isPinned: boolean;
  containsSpoilers: boolean;
  gate: Gate;
  author: AnnotationAuthor;
  likeCount: number;
  likedByMe: boolean;
  replyCount: number;
}

export interface ResolvedComment {
  id: string;
  clubId: string | null;
  parentId: string | null;
  locator: Locator | null;
  body: string | null;
  chapter: string | null;
  isPinned: boolean;
  containsSpoilers: boolean;
  gate: Gate;
  author: AnnotationAuthor;
  createdAt: number;
}

export interface PopularHighlight {
  normalizedText: string;
  count: number;
  locator: Locator | null;
}

export interface ReaderPage {
  book: { id: string; slug: string; title: string; author: string; epubUrl: string };
  /** Where the reader left off; null when signed out or never opened. */
  initialLocator: Locator | null;
  shareableClubs: { id: string; name: string }[];
}

/** GET /books/:id/annotations: every layer the viewer is entitled to, resolved
 *  server-side. Anonymous readers get public and popular only. */
export interface ReaderAnnotations {
  viewerProgressPct: number | null;
  mine: ReaderMine[];
  others: ResolvedOther[];
  comments: ResolvedComment[];
  popular: PopularHighlight[];
}

/** GET /annotations?types=: the reader's own annotations across every book, newest
 *  first (the highlights, commonplace and saved-passages pages). */
export interface MyAnnotation {
  id: string;
  type: AnnotationType;
  selectedText: string | null;
  body: string | null;
  color: string | null;
  chapter: string | null;
  sourceTitle: string | null;
  visibility: "private" | "friends" | "club" | "public";
  createdAt: number;
  bookId: string | null;
  bookTitle: string | null;
  bookSlug: string | null;
  bookAuthor: string | null;
}
