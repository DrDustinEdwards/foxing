// Catalog reads are hard-scoped to source_type='catalog'; readability is derived (catalog AND epub_url), never a column.
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { pageEnvelope } from "capsomer/behavior/pagination";
import { inList } from "@dustinedwards/site-runtime/d1";
import { clampPageSize } from "./page-size";
import { chunked, type Db } from "../../db";
import { bookAwards, books, userBooks } from "../../schema";
import { resolveEra, resolveLength, toGenres } from "./facets";

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
  // With a subject, start from the subject's index entries and look each book up by id. Left alone, SQLite (no
  // statistics on D1) walks every catalog book and probes book_subjects for each, reading the whole catalog on
  // every genre page. The unary plus on source_type keeps it from choosing that index instead, the documented
  // way to disable one (sqlite.org/optoverview.html, "Disabling Automatic Index Use").
  const conds = [
    params.subject ? sql`+${books.sourceType} = 'catalog'` : eq(books.sourceType, "catalog"),
  ];
  if (params.subject) {
    conds.push(
      sql`${books.id} IN (SELECT book_id FROM book_subjects WHERE subject = ${params.subject})`,
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

export async function listBooks(db: Db, params: BrowseParams = {}): Promise<BrowseResult> {
  const pageSize = clampPageSize(params.pageSize, 60, 24);
  const where = browseConditions(params);

  const order =
    params.sort === "year-desc"
      ? [sql`${books.publicationYear} DESC NULLS LAST`, asc(books.title)]
      : params.sort === "year-asc"
        ? [sql`${books.publicationYear} ASC NULLS LAST`, asc(books.title)]
        : [asc(sql`${books.title} COLLATE NOCASE`)];

  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(books)
    .where(where);
  const { page, perPage, pageCount, total, offset } = pageEnvelope(
    params.page ?? 1,
    pageSize,
    Number(count),
  );

  const rows = await db
    .select(CARD_COLUMNS)
    .from(books)
    .where(where)
    .orderBy(...order)
    .limit(perPage)
    .offset(offset);

  return { books: rows.map(toCard), total, page, pageSize: perPage, pageCount };
}

/** Resolves catalog AND community books; community books get detail pages but never enter browse/search/sitemap. */
export async function getBookBySlug(db: Db, slug: string): Promise<Book | null> {
  const rows = await db.select().from(books).where(eq(books.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function getBookById(db: Db, id: string): Promise<Book | null> {
  const rows = await db.select().from(books).where(eq(books.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getBooksByIds(db: Db, ids: string[]): Promise<BookCard[]> {
  if (ids.length === 0) return [];
  // A reading list can hold more books than one D1 statement may bind, so the ids go as one JSON parameter.
  const rows = await db
    .select(CARD_COLUMNS)
    .from(books)
    .where(and(inList(books.id, ids), eq(books.sourceType, "catalog")));
  const byId = new Map(rows.map((r) => [r.id, toCard(r)]));
  return ids.map((id) => byId.get(id)).filter((b): b is BookCard => !!b);
}

export async function listBooksByAuthorSlug(db: Db, authorSlug: string): Promise<BookCard[]> {
  const rows = await db
    .select(CARD_COLUMNS)
    .from(books)
    .where(and(eq(books.authorSlug, authorSlug), eq(books.sourceType, "catalog")))
    .orderBy(desc(books.publicationYear), asc(books.title));
  return rows.map(toCard);
}

/**
 * Other catalog books sharing the first genre, a different handful each time. Starts at a random id inside the subject's
 * index and wraps once; ORDER BY RANDOM() read every book of the subject on each page view.
 */
export async function getRelatedBooks(db: Db, book: Book, limit = 6): Promise<BookCard[]> {
  const subject = toGenres(book.subjects)[0];
  if (!subject) return [];
  const pivot = nanoid();
  const found: Array<RelatedRow> = [];
  const take = async (withCover: boolean, forward: boolean) => {
    const want = limit - found.length;
    if (want <= 0) return;
    const rows = await db.all<RelatedRow>(sql`
      SELECT b.id, b.slug, b.title, b.author, b.author_slug AS authorSlug, b.cover_url AS coverUrl,
             b.publication_year AS publicationYear, b.epub_url AS epubUrl
      FROM book_subjects bs
      JOIN books b ON b.id = bs.book_id
      WHERE bs.subject = ${subject}
        AND ${forward ? sql`bs.book_id >= ${pivot}` : sql`bs.book_id < ${pivot}`}
        AND b.source_type = 'catalog' AND b.id != ${book.id}
        AND ${withCover ? sql`b.cover_url IS NOT NULL` : sql`b.cover_url IS NULL`}
      ORDER BY bs.book_id
      LIMIT ${want}
    `);
    found.push(...rows);
  };
  await take(true, true);
  await take(true, false);
  await take(false, true);
  await take(false, false);
  return found.map(toCard);
}

type RelatedRow = Parameters<typeof toCard>[0];

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

export async function listStaffPicks(db: Db, limit = 10): Promise<BookCard[]> {
  const rows = await db
    .select(CARD_COLUMNS)
    .from(books)
    .where(and(eq(books.sourceType, "catalog"), eq(books.isStaffPick, true)))
    .orderBy(desc(books.updatedAt))
    .limit(limit);
  return rows.map(toCard);
}

export async function listNewest(db: Db, limit = 10): Promise<BookCard[]> {
  const rows = await db
    .select(CARD_COLUMNS)
    .from(books)
    .where(and(eq(books.sourceType, "catalog"), isNotNull(books.coverUrl)))
    .orderBy(desc(books.createdAt))
    .limit(limit);
  return rows.map(toCard);
}

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

/** Onboarding starters: award-winning catalog books with a cover, readable first, in a stable order. */
export async function listStarterBooks(db: Db, limit = 6): Promise<BookCard[]> {
  const rows = await db.all<RelatedRow>(sql`
    SELECT b.id, b.slug, b.title, b.author, b.author_slug AS authorSlug, b.cover_url AS coverUrl,
           b.publication_year AS publicationYear, b.epub_url AS epubUrl
    FROM books b
    JOIN book_awards ba ON ba.book_id = b.id
    WHERE b.source_type = 'catalog' AND b.cover_url IS NOT NULL
    GROUP BY b.id
    ORDER BY (b.epub_url IS NOT NULL) DESC, COUNT(ba.id) DESC, b.title ASC
    LIMIT ${limit}
  `);
  return rows.map(toCard);
}

/** Catalog books missing any of the given cached-generator actions, oldest-updated first. Action names are passed in to keep this repo decoupled from the companion registry. */
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

// Pool: catalog, readable, with a cover. The caller excludes owned books in memory; subjects/rating/staff-pick ride along so the ranker needs no second fetch.

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
  const placeholders = sql.join(
    list.map((a) => sql`${a}`),
    sql`, `,
  );
  return db
    .select(REC_COLUMNS)
    .from(books)
    .where(and(readableCatalog, sql`lower(${books.author}) IN (${placeholders})`))
    .orderBy(sql`${books.weightedRating} DESC NULLS LAST`, asc(books.title))
    .limit(limit);
}

export function listRecCandidatesBySubjects(
  db: Db,
  subjects: string[],
  limit = 200,
): Promise<RecCandidate[]> {
  const list = [...new Set(subjects.map((s) => s.toLowerCase()).filter(Boolean))].slice(0, 40);
  if (list.length === 0) return Promise.resolve([]);
  const placeholders = sql.join(
    list.map((s) => sql`${s}`),
    sql`, `,
  );
  return db
    .select(REC_COLUMNS)
    .from(books)
    .where(
      and(
        readableCatalog,
        sql`EXISTS (SELECT 1 FROM book_subjects bs WHERE bs.book_id = ${books.id} AND lower(bs.subject) IN (${placeholders}))`,
      ),
    )
    .orderBy(
      sql`${books.weightedRating} DESC NULLS LAST`,
      desc(books.ratingCount),
      asc(books.title),
    )
    .limit(limit);
}

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

export async function listSitemapAuthors(
  db: Db,
): Promise<Array<{ slug: string; updatedAt: Date }>> {
  const rows = await db.all<{ author_slug: string; updated_at: number }>(sql`
    SELECT author_slug, MAX(updated_at) AS updated_at FROM books
    WHERE source_type = 'catalog' AND author_slug IS NOT NULL AND author_slug != ''
    GROUP BY author_slug
    ORDER BY author_slug
  `);
  return rows.map((r) => ({ slug: r.author_slug, updatedAt: new Date(Number(r.updated_at)) }));
}

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
