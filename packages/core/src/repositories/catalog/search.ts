// Catalog search over the trigram books_fts index (catalog surface only).
//
// The FTS index uses SQLite's trigram tokenizer, which gives substring matching but
// NOT substitution-typo tolerance ('ostoevsk' matches 'Dostoyevsky'; 'Dostoevski'
// does not, because it needs every query trigram present contiguously). The
// crown-jewel promise "a misspelled author still returns the right book" is met here,
// at the app layer (deferred-items.md): on zero strict matches we re-query with the
// term's trigrams OR'd and rank by bm25, so a wrong letter still overlaps enough
// trigrams to surface the intended book.
import { sql } from "drizzle-orm";
import type { Db } from "../../db";
import { type BookCard, getBooksByIds } from "./books";

export type SearchResult = {
  books: BookCard[];
  total: number;
  fuzzy: boolean;
  page: number;
  pageSize: number;
  pageCount: number;
};

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

/** Strict MATCH: quoted tokens (>=3 chars) ANDed. Quoting neutralizes FTS keywords. */
export function strictExpr(q: string): string | null {
  const usable = tokens(q).filter((t) => t.length >= 3);
  if (usable.length === 0) return null;
  return usable.map((t) => `"${t}"`).join(" AND ");
}

/** Overlapping trigrams of every usable token, OR'd. Powers the typo fallback. */
export function fuzzyExpr(q: string): string | null {
  const grams = new Set<string>();
  for (const t of tokens(q)) {
    for (let i = 0; i + 3 <= t.length; i++) grams.add(t.slice(i, i + 3));
  }
  if (grams.size === 0) return null;
  return [...grams].map((g) => `"${g}"`).join(" OR ");
}

async function runMatch(
  db: Db,
  expr: string,
  page: number,
  pageSize: number,
): Promise<{ ids: string[]; total: number }> {
  const offset = (page - 1) * pageSize;
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

export async function searchCatalog(
  db: Db,
  rawQuery: string,
  opts: { page?: number; pageSize?: number } = {},
): Promise<SearchResult> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, opts.pageSize ?? 24));
  const empty: SearchResult = { books: [], total: 0, fuzzy: false, page, pageSize, pageCount: 1 };

  const q = sanitize(rawQuery);
  if (!q) return empty;

  const strict = strictExpr(q);
  let fuzzy = false;
  let ids: string[] = [];
  let total = 0;

  if (strict) {
    const res = await runMatch(db, strict, page, pageSize);
    ids = res.ids;
    total = res.total;
  }

  // No strict hits (typo, variant spelling): fall back to OR'd trigrams, bm25-ranked.
  if (total === 0) {
    const expr = fuzzyExpr(q);
    if (expr) {
      const res = await runMatch(db, expr, page, pageSize);
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
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Fast, small type-ahead suggestions (strict substring only, first page). */
export async function suggest(db: Db, rawQuery: string, limit = 8): Promise<BookCard[]> {
  const q = sanitize(rawQuery);
  const strict = strictExpr(q);
  if (!strict) return [];
  const rows = await db.all<{ book_id: string }>(sql`
    SELECT book_id FROM books_fts
    WHERE books_fts MATCH ${strict} AND source_type = 'catalog'
    ORDER BY bm25(books_fts) LIMIT ${limit}
  `);
  return getBooksByIds(db, rows.map((r) => r.book_id));
}
