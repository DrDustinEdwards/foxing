// Catalog book reads. Every public query is hard-scoped to source_type='catalog';
// community books never appear on the browse/search/sitemap surface (spec-cf-schema
// rev 3). Readability is derived (catalog AND epub_url present), never a column.
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { chunked, type Db } from "../../db";
import { bookAwards, books, userBooks } from "../../schema";
import { resolveEra, resolveLength } from "./facets";

export type Book = typeof books.$inferSelect;

const CARD_COLUMNS = {
  id: books.id,
  slug: books.slug,
  title: books.title,
  author: books.author,
  authorSlug: books.authorSlug,
  coverUrl: books.coverUrl,
  publicationYear: books.publicationYear,
  epubUrl: books.epubUrl,
} as const;

export type BookCard = {
  id: string;
  slug: string;
  title: string;
  author: string;
  authorSlug: string | null;
  coverUrl: string | null;
  publicationYear: number | null;
  readable: boolean;
};

function toCard(row: {
  id: string;
  slug: string;
  title: string;
  author: string;
  authorSlug: string | null;
  coverUrl: string | null;
  publicationYear: number | null;
  epubUrl: string | null;
}): BookCard {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    author: row.author,
    authorSlug: row.authorSlug,
    coverUrl: row.coverUrl,
    publicationYear: row.publicationYear,
    readable: !!row.epubUrl,
  };
}

/** Whether a book can be opened in the reader (sub-slice 2 owns the reader itself). */
export function isReadable(book: Pick<Book, "sourceType" | "epubUrl">): boolean {
  return book.sourceType === "catalog" && !!book.epubUrl;
}

export type BrowseParams = {
  subject?: string;
  era?: string;
  length?: string;
  sort?: "title" | "year-desc" | "year-asc";
  page?: number;
  pageSize?: number;
};

export type BrowseResult = {
  books: BookCard[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

function browseConditions(params: BrowseParams) {
  const conds = [eq(books.sourceType, "catalog")];
  if (params.subject) {
    conds.push(
      sql`EXISTS (SELECT 1 FROM json_each(${books.subjects}) je WHERE je.value = ${params.subject})`,
    );
  }
  const era = resolveEra(params.era);
  if (era) {
    conds.push(sql`${books.publicationYear} BETWEEN ${era.min} AND ${era.max}`);
  }
  const length = resolveLength(params.length);
  if (length) {
    conds.push(sql`${books.wordCount} BETWEEN ${length.min} AND ${length.max}`);
  }
  return and(...conds);
}

/** Browse with filters + offset pagination (page numbers are crawlable for SEO). */
export async function listBooks(db: Db, params: BrowseParams = {}): Promise<BrowseResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(60, Math.max(1, params.pageSize ?? 24));
  const where = browseConditions(params);

  const order =
    params.sort === "year-desc"
      ? [sql`${books.publicationYear} DESC NULLS LAST`, asc(books.title)]
      : params.sort === "year-asc"
        ? [sql`${books.publicationYear} ASC NULLS LAST`, asc(books.title)]
        : [asc(sql`${books.title} COLLATE NOCASE`)];

  const rows = await db
    .select(CARD_COLUMNS)
    .from(books)
    .where(where)
    .orderBy(...order)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [{ count }] = await db.select({ count: sql<number>`COUNT(*)` }).from(books).where(where);
  const total = Number(count);

  return {
    books: rows.map(toCard),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * Full book detail by slug, resolving BOTH catalog and community books. Community
 * books get detail pages (needed for the picks/club/diary/buy surfaces) but the page
 * marks them noindex and they never enter browse/search/sitemap (spec-cf-schema rev 3).
 */
export async function getBookBySlug(db: Db, slug: string): Promise<Book | null> {
  const rows = await db.select().from(books).where(eq(books.slug, slug)).limit(1);
  return rows[0] ?? null;
}

/** Full book detail by id. Same resolution rules as getBookBySlug. */
export async function getBookById(db: Db, id: string): Promise<Book | null> {
  const rows = await db.select().from(books).where(eq(books.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Books by ids, returned in the order the ids were given (for FTS result ordering). */
export async function getBooksByIds(db: Db, ids: string[]): Promise<BookCard[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select(CARD_COLUMNS)
    .from(books)
    .where(and(inArray(books.id, ids), eq(books.sourceType, "catalog")));
  const byId = new Map(rows.map((r) => [r.id, toCard(r)]));
  return ids.map((id) => byId.get(id)).filter((b): b is BookCard => !!b);
}

/** All books credited to one author slug (catalog only), newest first. */
export async function listBooksByAuthorSlug(db: Db, authorSlug: string): Promise<BookCard[]> {
  const rows = await db
    .select(CARD_COLUMNS)
    .from(books)
    .where(and(eq(books.authorSlug, authorSlug), eq(books.sourceType, "catalog")))
    .orderBy(desc(books.publicationYear), asc(books.title));
  return rows.map(toCard);
}

/** Up to `limit` other catalog books sharing the book's first subject. */
export async function getRelatedBooks(db: Db, book: Book, limit = 6): Promise<BookCard[]> {
  const subject = (book.subjects ?? [])[0];
  if (!subject) return [];
  const rows = await db.all<{
    id: string;
    slug: string;
    title: string;
    author: string;
    author_slug: string | null;
    cover_url: string | null;
    publication_year: number | null;
    epub_url: string | null;
  }>(sql`
    SELECT b.id, b.slug, b.title, b.author, b.author_slug, b.cover_url, b.publication_year, b.epub_url
    FROM books b, json_each(b.subjects) je
    WHERE b.source_type = 'catalog' AND je.value = ${subject} AND b.id != ${book.id}
    GROUP BY b.id
    ORDER BY b.cover_url IS NULL, RANDOM()
    LIMIT ${limit}
  `);
  return rows.map((r) =>
    toCard({
      id: r.id,
      slug: r.slug,
      title: r.title,
      author: r.author,
      authorSlug: r.author_slug,
      coverUrl: r.cover_url,
      publicationYear: r.publication_year,
      epubUrl: r.epub_url,
    }),
  );
}

/** The next catalog book in the same series, by series order; null when there is none. */
export async function getNextInSeries(db: Db, book: Book): Promise<BookCard | null> {
  if (!book.seriesName) return null;
  const conds = [
    eq(books.seriesName, book.seriesName),
    eq(books.sourceType, "catalog"),
    sql`${books.id} != ${book.id}`,
  ];
  if (book.seriesOrder != null) conds.push(sql`${books.seriesOrder} > ${book.seriesOrder}`);
  const rows = await db
    .select(CARD_COLUMNS)
    .from(books)
    .where(and(...conds))
    .orderBy(sql`${books.seriesOrder} ASC NULLS LAST`)
    .limit(1);
  return rows[0] ? toCard(rows[0]) : null;
}

/** Catalog books the staff picked, most recently picked first. */
export async function listStaffPicks(db: Db, limit = 10): Promise<BookCard[]> {
  const rows = await db
    .select(CARD_COLUMNS)
    .from(books)
    .where(and(eq(books.sourceType, "catalog"), eq(books.isStaffPick, true)))
    .orderBy(desc(books.updatedAt))
    .limit(limit);
  return rows.map(toCard);
}

/** The newest catalog books with a cover. */
export async function listNewest(db: Db, limit = 10): Promise<BookCard[]> {
  const rows = await db
    .select(CARD_COLUMNS)
    .from(books)
    .where(and(eq(books.sourceType, "catalog"), isNotNull(books.coverUrl)))
    .orderBy(desc(books.createdAt))
    .limit(limit);
  return rows.map(toCard);
}

/** Catalog books most often shelved in the given window, most first. */
export async function listTrending(db: Db, sinceMs: number, limit = 10): Promise<BookCard[]> {
  const rows = await db
    .select({ ...CARD_COLUMNS, n: sql<number>`COUNT(*)` })
    .from(userBooks)
    .innerJoin(books, eq(books.id, userBooks.bookId))
    .where(and(eq(books.sourceType, "catalog"), sql`${userBooks.createdAt} >= ${sinceMs}`))
    .groupBy(books.id)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(limit);
  return rows.map(toCard);
}

/**
 * Curated starter set for onboarding: award-winning catalog books with a cover,
 * readable ones first so the eventual "Read now" works. Deterministic order (most
 * awarded, then title) so the handoff is stable across sessions.
 */
export async function listStarterBooks(db: Db, limit = 6): Promise<BookCard[]> {
  const rows = await db.all<{
    id: string;
    slug: string;
    title: string;
    author: string;
    author_slug: string | null;
    cover_url: string | null;
    publication_year: number | null;
    epub_url: string | null;
  }>(sql`
    SELECT b.id, b.slug, b.title, b.author, b.author_slug, b.cover_url,
           b.publication_year, b.epub_url
    FROM books b
    JOIN book_awards ba ON ba.book_id = b.id
    WHERE b.source_type = 'catalog' AND b.cover_url IS NOT NULL
    GROUP BY b.id
    ORDER BY (b.epub_url IS NOT NULL) DESC, COUNT(ba.id) DESC, b.title ASC
    LIMIT ${limit}
  `);
  return rows.map((r) =>
    toCard({
      id: r.id,
      slug: r.slug,
      title: r.title,
      author: r.author,
      authorSlug: r.author_slug,
      coverUrl: r.cover_url,
      publicationYear: r.publication_year,
      epubUrl: r.epub_url,
    }),
  );
}

/**
 * Catalog books missing at least one of the given cached-generator actions
 * (book_ai_cache), oldest-updated first. Used by the companion cache Cron/Queue to
 * pick a small batch instead of scanning the whole catalog. Action names are passed
 * in rather than imported, so this repository stays decoupled from the companion
 * registry.
 */
export async function findBooksNeedingCache(
  db: Db,
  actionNames: readonly string[],
  limit: number,
): Promise<Book[]> {
  const actionsList = sql.join(
    actionNames.map((a) => sql`${a}`),
    sql`, `,
  );
  const rows = await db
    .select()
    .from(books)
    .where(
      and(
        eq(books.sourceType, "catalog"),
        sql`(
          SELECT COUNT(*) FROM book_ai_cache
          WHERE book_ai_cache.book_id = ${books.id} AND book_ai_cache.action IN (${actionsList})
        ) < ${actionNames.length}`,
      ),
    )
    .orderBy(asc(books.updatedAt))
    .limit(limit);
  return rows;
}

// --- Recommendation candidates (Find next book) ----------------------------
// The candidate pool is catalog + readable (epub present) + has a cover, so every
// recommended book can be opened and shows a cover. Owned books are excluded by the
// caller in-memory (the exclusion set is per-user and small). subjects/rating/staff-pick
// come along so the ranker can score without a second fetch.

export interface RecCandidate {
  id: string;
  slug: string;
  title: string;
  author: string;
  authorSlug: string | null;
  coverUrl: string | null;
  publicationYear: number | null;
  subjects: string[] | null;
  weightedRating: number | null;
  ratingCount: number;
  isStaffPick: boolean;
}

const REC_COLUMNS = {
  id: books.id,
  slug: books.slug,
  title: books.title,
  author: books.author,
  authorSlug: books.authorSlug,
  coverUrl: books.coverUrl,
  publicationYear: books.publicationYear,
  subjects: books.subjects,
  weightedRating: books.weightedRating,
  ratingCount: books.ratingCount,
  isStaffPick: books.isStaffPick,
} as const;

const readableCatalog = and(
  eq(books.sourceType, "catalog"),
  isNotNull(books.epubUrl),
  isNotNull(books.coverUrl),
);

/** Top readable catalog books by rating, the always-available base pool. */
export function listRecCandidatesByRating(db: Db, limit = 400): Promise<RecCandidate[]> {
  return db
    .select(REC_COLUMNS)
    .from(books)
    .where(readableCatalog)
    .orderBy(
      sql`${books.weightedRating} DESC NULLS LAST`,
      desc(books.ratingCount),
      asc(books.title),
    )
    .limit(limit);
}

/** Readable catalog books by any of the given authors (case-insensitive), so behavior
 *  signals like "more from this author" always have candidates in the pool. */
export function listRecCandidatesByAuthors(
  db: Db,
  authors: string[],
  limit = 150,
): Promise<RecCandidate[]> {
  const list = authors
    .map((a) => a.toLowerCase())
    .filter(Boolean)
    .slice(0, 40);
  if (list.length === 0) return Promise.resolve([]);
  const inList = sql.join(
    list.map((a) => sql`${a}`),
    sql`, `,
  );
  return db
    .select(REC_COLUMNS)
    .from(books)
    .where(and(readableCatalog, sql`lower(${books.author}) IN (${inList})`))
    .orderBy(sql`${books.weightedRating} DESC NULLS LAST`, asc(books.title))
    .limit(limit);
}

/** Readable catalog books whose subjects overlap any of the given genres
 *  (case-insensitive), so favorite/behavior genres always have candidates. */
export function listRecCandidatesBySubjects(
  db: Db,
  subjects: string[],
  limit = 200,
): Promise<RecCandidate[]> {
  const list = [...new Set(subjects.map((s) => s.toLowerCase()).filter(Boolean))].slice(0, 40);
  if (list.length === 0) return Promise.resolve([]);
  const inList = sql.join(
    list.map((s) => sql`${s}`),
    sql`, `,
  );
  return db
    .select(REC_COLUMNS)
    .from(books)
    .where(
      and(
        readableCatalog,
        sql`EXISTS (SELECT 1 FROM json_each(${books.subjects}) je WHERE lower(je.value) IN (${inList}))`,
      ),
    )
    .orderBy(
      sql`${books.weightedRating} DESC NULLS LAST`,
      desc(books.ratingCount),
      asc(books.title),
    )
    .limit(limit);
}

/** Which of the given book ids are award winners (for the "Award winner" reason). */
export async function listAwardWinnerIds(db: Db, bookIds: string[]): Promise<string[]> {
  if (bookIds.length === 0) return [];
  // The recommendation pool can be several hundred ids; a flat inArray would pass D1's
  // bound-parameter limit (db.ts) and 500.
  const found = new Set<string>();
  for (const chunk of chunked(bookIds)) {
    const rows = await db
      .selectDistinct({ bookId: bookAwards.bookId })
      .from(bookAwards)
      .where(inArray(bookAwards.bookId, chunk));
    for (const r of rows) found.add(r.bookId);
  }
  return [...found];
}

/** Distinct author slugs across the catalog, for the sitemap. */
export async function listAuthorSlugs(db: Db): Promise<string[]> {
  const rows = await db.all<{ author_slug: string }>(sql`
    SELECT DISTINCT author_slug FROM books
    WHERE source_type = 'catalog' AND author_slug IS NOT NULL AND author_slug != ''
    ORDER BY author_slug
  `);
  return rows.map((r) => r.author_slug);
}

/** Minimal rows for the sitemap: catalog slugs, last-modified and cover. */
export async function listSitemapBooks(
  db: Db,
): Promise<Array<{ slug: string; updatedAt: Date; coverUrl: string | null }>> {
  const rows = await db
    .select({ slug: books.slug, updatedAt: books.updatedAt, coverUrl: books.coverUrl })
    .from(books)
    .where(eq(books.sourceType, "catalog"))
    .orderBy(asc(books.slug));
  return rows.map((r) => ({ ...r, updatedAt: r.updatedAt ?? new Date(0) }));
}
