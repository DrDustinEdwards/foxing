// Catalog book reads. Every public query is hard-scoped to source_type='catalog';
// community books never appear on the browse/search/sitemap surface (spec-cf-schema
// rev 3). Readability is derived (catalog AND epub_url present), never a column.
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../../db";
import { books } from "../../schema";
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

  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(books)
    .where(where);
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

/** Minimal rows for the sitemap: catalog slugs + last-modified. */
export async function listSitemapBooks(db: Db): Promise<Array<{ slug: string; updatedAt: Date }>> {
  const rows = await db
    .select({ slug: books.slug, updatedAt: books.updatedAt })
    .from(books)
    .where(eq(books.sourceType, "catalog"))
    .orderBy(asc(books.slug));
  return rows.map((r) => ({ slug: r.slug, updatedAt: r.updatedAt ?? new Date(0) }));
}
