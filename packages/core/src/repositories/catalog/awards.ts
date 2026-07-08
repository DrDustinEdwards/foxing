// Literary awards. book_awards rows group by award_slug into award pages
// (/awards + /awards/:slug). Award-winning books are catalog titles.
import { sql } from "drizzle-orm";
import type { Db } from "../../db";
import type { BookCard } from "./books";

export type AwardSummary = {
  slug: string;
  name: string;
  scope: string | null;
  count: number;
};

export type AwardEntry = {
  year: number | null;
  distinction: string;
  book: BookCard;
};

export type AwardDetail = {
  slug: string;
  name: string;
  scope: string | null;
  entries: AwardEntry[];
};

export type BookAward = {
  awardSlug: string;
  awardName: string;
  year: number | null;
  distinction: string;
};

/** Awards attached to one book (for the book detail page). */
export async function getBookAwards(db: Db, bookId: string): Promise<BookAward[]> {
  const rows = await db.all<{
    award_slug: string;
    award_name: string;
    year: number | null;
    distinction: string;
  }>(sql`
    SELECT award_slug, award_name, year, distinction
    FROM book_awards WHERE book_id = ${bookId}
    ORDER BY year DESC
  `);
  return rows.map((r) => ({
    awardSlug: r.award_slug,
    awardName: r.award_name,
    year: r.year,
    distinction: r.distinction,
  }));
}

export async function listAwards(db: Db): Promise<AwardSummary[]> {
  const rows = await db.all<{
    slug: string;
    name: string;
    scope: string | null;
    count: number;
  }>(sql`
    SELECT award_slug AS slug, award_name AS name, MAX(scope) AS scope, COUNT(*) AS count
    FROM book_awards
    GROUP BY award_slug
    ORDER BY count DESC, name ASC
  `);
  return rows.map((r) => ({ ...r, count: Number(r.count) }));
}

export async function getAwardBySlug(db: Db, slug: string): Promise<AwardDetail | null> {
  const rows = await db.all<{
    name: string;
    scope: string | null;
    year: number | null;
    distinction: string;
    id: string;
    b_slug: string;
    title: string;
    author: string;
    author_slug: string | null;
    cover_url: string | null;
    publication_year: number | null;
    epub_url: string | null;
  }>(sql`
    SELECT ba.award_name AS name, ba.scope AS scope, ba.year AS year, ba.distinction AS distinction,
           b.id AS id, b.slug AS b_slug, b.title AS title, b.author AS author,
           b.author_slug AS author_slug, b.cover_url AS cover_url,
           b.publication_year AS publication_year, b.epub_url AS epub_url
    FROM book_awards ba
    JOIN books b ON b.id = ba.book_id
    WHERE ba.award_slug = ${slug} AND b.source_type = 'catalog'
    ORDER BY ba.year DESC, b.title ASC
  `);
  if (rows.length === 0) return null;
  return {
    slug,
    name: rows[0].name,
    scope: rows[0].scope,
    entries: rows.map((r) => ({
      year: r.year,
      distinction: r.distinction,
      book: {
        id: r.id,
        slug: r.b_slug,
        title: r.title,
        author: r.author,
        authorSlug: r.author_slug,
        coverUrl: r.cover_url,
        publicationYear: r.publication_year,
        readable: !!r.epub_url,
      },
    })),
  };
}
