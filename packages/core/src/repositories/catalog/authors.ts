// Authors are derived from books.author_slug (there is no authors table). One page
// per author slug, per the standing URL decision (/authors/:slug).
import type { Db } from "../../db";
import { type BookCard, listBooksByAuthorSlug } from "./books";

export type Author = {
  slug: string;
  name: string;
  bookCount: number;
  yearRange: { first: number; last: number } | null;
  books: BookCard[];
};

export async function getAuthor(db: Db, slug: string): Promise<Author | null> {
  const bookList = await listBooksByAuthorSlug(db, slug);
  if (bookList.length === 0) return null;
  const years = bookList
    .map((b) => b.publicationYear)
    .filter((y): y is number => typeof y === "number");
  return {
    slug,
    name: bookList[0].author,
    bookCount: bookList.length,
    yearRange: years.length ? { first: Math.min(...years), last: Math.max(...years) } : null,
    books: bookList,
  };
}
