// Every cache key in one place, so a write can name exactly what it changed.
// Keys are prefixes: invalidating ["clubs"] refetches every club view.

export const keys = {
  me: ["me"] as const,
  usernameAvailable: (name: string) => ["me", "username", name] as const,
  accountClubs: ["me", "clubs"] as const,
  library: ["library"] as const,
  myBook: (bookId: string) => ["library", "book", bookId] as const,
  shelves: ["shelves"] as const,
  shelf: (id: string) => ["shelves", id] as const,
  goals: ["goals"] as const,
  streak: ["streak"] as const,
  vocabulary: ["vocabulary"] as const,
  notifications: ["notifications"] as const,
  clubs: ["clubs"] as const,
  clubsIndex: ["clubs", "index"] as const,
  /** Club pages, keyed by whatever the screen has: id or slug. */
  clubPages: ["clubs", "page"] as const,
  clubPage: (idOrSlug: string) => ["clubs", "page", idOrSlug] as const,
  threads: ["clubs", "thread"] as const,
  thread: (id: string) => ["clubs", "thread", id] as const,
  feed: ["feed"] as const,
  profiles: ["profiles"] as const,
  profile: (username: string) => ["profiles", username] as const,
  diary: ["diary"] as const,
  people: ["people"] as const,
  lists: ["lists"] as const,
  list: (id: string) => ["lists", id] as const,
  suggest: (q: string) => ["suggest", q] as const,
  annotations: (bookId: string) => ["annotations", bookId] as const,
  allMyAnnotations: ["annotations", "mine"] as const,
  myAnnotations: (types: string) => ["annotations", "mine", types] as const,
  stats: ["stats"] as const,
  browse: (query: CatalogQuery) => ["books", "browse", query] as const,
  search: (q: string, query: CatalogQuery) => ["books", "search", q, query] as const,
  book: (idOrSlug: string) => ["books", "page", idOrSlug] as const,
  author: (slug: string) => ["authors", slug] as const,
  recommendations: ["recommendations"] as const,
};

/** The filters the catalog's browse and search pages take. */
export interface CatalogQuery {
  subject?: string;
  era?: string;
  length?: string;
  sort?: "title" | "year-desc" | "year-asc";
  page?: number;
}
