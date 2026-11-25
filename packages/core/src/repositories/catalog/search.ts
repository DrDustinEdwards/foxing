// Catalog search over the trigram books_fts index (catalog only). Trigrams give substring matching but not substitution-typo
// tolerance, so on zero strict matches we re-query with the term's trigrams OR'd and rank by bm25: a misspelled author still
// returns the right book.
import { ftsLiteral } from "@drdustinedwards/site-helpers/search";
import { sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { clampPageSize } from "./page-size";
import type { Db } from "../../db";
import { type BookCard, getBooksByIds } from "./books";
import { resolveEra, resolveLength } from "./facets";
import { pageCountOf } from "capsomer/behavior/pagination";

export type SearchResult = {
  books: BookCard[];
  total: number;
  fuzzy: boolean;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type SearchFilters = {
  subject?: string | null;
  era?: string | null;
  length?: string | null;
};

export type AuthorHit = {
  author: string;
  authorSlug: string;
  bookCount: number;
};

function filterConditions(filters: SearchFilters): SQL[] {
  const conds: SQL[] = [];
  if (filters.subject) {
    conds.push(
      sql`EXISTS (SELECT 1 FROM book_subjects bs WHERE bs.book_id = b.id AND bs.subject = ${filters.subject})`,
    );
  }
  const era = resolveEra(filters.era);
  if (era) conds.push(sql`b.publication_year BETWEEN ${era.min} AND ${era.max}`);
  const length = resolveLength(filters.length);
  if (length) conds.push(sql`b.word_count BETWEEN ${length.min} AND ${length.max}`);
  return conds;
}

/** Keep letters, digits, spaces. Everything else is an FTS operator we do not want. */
export function sanitize(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(q: string): string[] {
  return q.split(" ").filter(Boolean);
}

/** Strict MATCH: tokens (>=3 chars) as FTS literals, ANDed. Quoting neutralizes FTS keywords. */
export function strictExpr(q: string): string | null {
  const usable = tokens(q).filter((t) => t.length >= 3);
  if (usable.length === 0) return null;
  return usable.map(ftsLiteral).join(" AND ");
}

export function fuzzyExpr(q: string): string | null {
  const grams = new Set<string>();
  for (const t of tokens(q)) {
    for (let i = 0; i + 3 <= t.length; i++) grams.add(t.slice(i, i + 3));
  }
  if (grams.size === 0) return null;
  return [...grams].map(ftsLiteral).join(" OR ");
}

async function runMatch(
  db: Db,
  expr: string,
  page: number,
  pageSize: number,
  filters: SearchFilters,
): Promise<{ ids: string[]; total: number }> {
  const offset = (page - 1) * pageSize;
  const conds = filterConditions(filters);

  if (conds.length === 0) {
    const rows = await db.all<{ book_id: string }>(sql`
      SELECT book_id FROM books_fts
      WHERE books_fts MATCH ${expr} AND source_type = 'catalog'
      ORDER BY bm25(books_fts) LIMIT ${pageSize} OFFSET ${offset}
    `);
    const [{ n }] = await db.all<{ n: number }>(sql`
      SELECT COUNT(*) AS n FROM books_fts
      WHERE books_fts MATCH ${expr} AND source_type = 'catalog'
    `);
    return { ids: rows.map((r) => r.book_id), total: Number(n) };
  }

  // Filters present: join the catalog row and AND the column predicates. bm25 still
  // ranks on the matched FTS table (books_fts stays unaliased so the aux fn resolves).
  const where = sql.join(conds, sql` AND `);
  const rows = await db.all<{ book_id: string }>(sql`
    SELECT books_fts.book_id FROM books_fts
    JOIN books b ON b.id = books_fts.book_id
    WHERE books_fts MATCH ${expr} AND books_fts.source_type = 'catalog' AND ${where}
    ORDER BY bm25(books_fts) LIMIT ${pageSize} OFFSET ${offset}
  `);
  const [{ n }] = await db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM books_fts
    JOIN books b ON b.id = books_fts.book_id
    WHERE books_fts MATCH ${expr} AND books_fts.source_type = 'catalog' AND ${where}
  `);
  return { ids: rows.map((r) => r.book_id), total: Number(n) };
}

export async function searchCatalog(
  db: Db,
  rawQuery: string,
  opts: { page?: number; pageSize?: number } & SearchFilters = {},
): Promise<SearchResult> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = clampPageSize(opts.pageSize, 48, 24);
  const empty: SearchResult = { books: [], total: 0, fuzzy: false, page, pageSize, pageCount: 1 };

  const q = sanitize(rawQuery);
  if (!q) return empty;

  const filters: SearchFilters = { subject: opts.subject, era: opts.era, length: opts.length };
  const strict = strictExpr(q);
  let fuzzy = false;
  let ids: string[] = [];
  let total = 0;

  if (strict) {
    const res = await runMatch(db, strict, page, pageSize, filters);
    ids = res.ids;
    total = res.total;
  }

  if (total === 0) {
    const expr = fuzzyExpr(q);
    if (expr) {
      const res = await runMatch(db, expr, page, pageSize, filters);
      ids = res.ids;
      total = res.total;
      fuzzy = res.total > 0;
    }
  }

  const found = await getBooksByIds(db, ids);
  return {
    books: found,
    total,
    fuzzy,
    page,
    pageSize,
    pageCount: pageCountOf(total, pageSize),
  };
}

/** Authors whose name contains the query, by catalog book count. Derived from books (no authors table), so a plain substring match. */
export async function searchAuthors(db: Db, rawQuery: string, limit = 8): Promise<AuthorHit[]> {
  const q = sanitize(rawQuery);
  if (!q) return [];
  const like = `%${q.split(" ").filter(Boolean).join("%")}%`;
  const rows = await db.all<{ author: string; author_slug: string; n: number }>(sql`
    SELECT author, author_slug, COUNT(*) AS n
    FROM books
    WHERE source_type = 'catalog'
      AND author_slug IS NOT NULL AND author_slug != ''
      AND lower(author) LIKE ${like}
    GROUP BY author_slug
    ORDER BY n DESC, author ASC
    LIMIT ${limit}
  `);
  return rows.map((r) => ({
    author: r.author,
    authorSlug: r.author_slug,
    bookCount: Number(r.n),
  }));
}

export async function suggest(db: Db, rawQuery: string, limit = 8): Promise<BookCard[]> {
  const q = sanitize(rawQuery);
  const strict = strictExpr(q);
  if (!strict) return [];
  const rows = await db.all<{ book_id: string }>(sql`
    SELECT book_id FROM books_fts
    WHERE books_fts MATCH ${strict} AND source_type = 'catalog'
    ORDER BY bm25(books_fts) LIMIT ${limit}
  `);
  return getBooksByIds(
    db,
    rows.map((r) => r.book_id),
  );
}
