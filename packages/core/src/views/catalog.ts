// Catalog views: public reads of books, authors and search in their /api/v1 wire
// shape (@foxing/types). Nothing here depends on the viewer, so every one of them is
// safe to cache at the edge. The reader's own state on a book is views.myBook.
import type * as W from "@foxing/types";
import { type AffiliateConfig, buyLinks } from "../config/affiliate";
import type { Db } from "../db";
import * as catalogRepo from "../repositories/catalog";
import * as clubsRepo from "../repositories/clubs";
import * as companionRepo from "../repositories/companion";
import * as diaryRepo from "../repositories/diary";
import * as libraryRepo from "../repositories/library";
import * as profilesRepo from "../repositories/profiles";
import * as readerSocial from "../repositories/reader-social";
import { clubsReading } from "./clubs";
import { ms } from "./wire";

/** Only public profiles and public clubs are returned. */
export async function suggest(db: Db, q: string): Promise<W.SearchSuggest> {
  if (q.trim().length < 2) return { books: [], authors: [], people: [], clubs: [] };
  const [books, authors, people, clubs] = await Promise.all([
    catalogRepo.suggest(db, q, 6),
    catalogRepo.searchAuthors(db, q, 4),
    profilesRepo.searchProfiles(db, q, 4),
    clubsRepo.searchClubs(db, q, 4),
  ]);
  return {
    books: books.map((b) => ({
      id: b.id,
      slug: b.slug,
      title: b.title,
      author: b.author,
      coverUrl: b.coverUrl,
    })),
    authors: authors.map((a) => ({ slug: a.authorSlug, name: a.author, bookCount: a.bookCount })),
    people: people.map((p) => ({ username: p.username, displayName: p.displayName ?? p.username })),
    clubs: clubs.map((c) => ({ slug: c.slug, name: c.name })),
  };
}

const BROWSE_SORTS = new Set(["title", "year-desc", "year-asc"]);

export interface CatalogQuery {
  subject?: string | null;
  era?: string | null;
  length?: string | null;
  sort?: string | null;
  page?: number;
}

/** One page of the catalog, filtered, with the genre facets the filter bar offers. */
export async function browse(db: Db, query: CatalogQuery): Promise<W.BrowsePage> {
  const [result, genres] = await Promise.all([
    catalogRepo.listBooks(db, {
      subject: query.subject || undefined,
      era: query.era || undefined,
      length: query.length || undefined,
      sort: BROWSE_SORTS.has(query.sort ?? "")
        ? (query.sort as catalogRepo.BrowseParams["sort"])
        : undefined,
      page: query.page,
    }),
    catalogRepo.getGenreFacets(db, 18),
  ]);
  return {
    books: result.books,
    total: result.total,
    page: result.page,
    pageCount: result.pageCount,
    genres,
  };
}

/** Full search: books (typo-tolerant), matching authors, and the genre facets. */
export async function search(db: Db, q: string, query: CatalogQuery): Promise<W.SearchPage> {
  const term = q.trim();
  if (!term) {
    return {
      q: term,
      books: [],
      total: 0,
      page: 1,
      pageCount: 1,
      fuzzy: false,
      authors: [],
      genres: [],
    };
  }
  const [result, authors, genres] = await Promise.all([
    catalogRepo.searchCatalog(db, term, {
      page: query.page,
      subject: query.subject,
      era: query.era,
      length: query.length,
    }),
    catalogRepo.searchAuthors(db, term, 8),
    catalogRepo.getGenreFacets(db, 12),
  ]);
  return {
    q: term,
    books: result.books,
    total: result.total,
    page: result.page,
    pageCount: result.pageCount,
    fuzzy: result.fuzzy,
    authors: authors.map((a) => ({ slug: a.authorSlug, name: a.author, bookCount: a.bookCount })),
    genres,
  };
}

function cachedText(row: { content: unknown } | undefined): string | null {
  return typeof row?.content === "string" && row.content.trim() ? row.content : null;
}

export async function author(db: Db, slug: string): Promise<W.AuthorPage | null> {
  const found = await catalogRepo.getAuthor(db, slug);
  if (!found) return null;
  const bio = found.books[0]
    ? await companionRepo.getCachedAction(db, found.books[0].id, "author_bio")
    : null;
  return { ...found, bio: cachedText(bio ?? undefined) };
}

/** The book page, found by id or slug: detail, awards, neighbours, the generated
 *  catalog text, public reviews, clubs reading it and its popular passages. */
export async function bookPage(
  db: Db,
  idOrSlug: string,
  affiliate: AffiliateConfig = {},
): Promise<W.BookPage | null> {
  const book =
    (await catalogRepo.getBookById(db, idOrSlug)) ??
    (await catalogRepo.getBookBySlug(db, idOrSlug));
  if (!book) return null;

  const [awards, related, byAuthor, nextInSeries, cached, reviewRows, clubs, popular, readerCount] =
    await Promise.all([
      catalogRepo.getBookAwards(db, book.id),
      catalogRepo.getRelatedBooks(db, book, 6),
      book.authorSlug ? catalogRepo.listBooksByAuthorSlug(db, book.authorSlug) : [],
      catalogRepo.getNextInSeries(db, book),
      companionRepo.listCachedActions(db, book.id),
      diaryRepo.listPublicReviewsForBook(db, book.id, 3),
      clubsReading(db, book.id),
      readerSocial.popularHighlights(db, book.id),
      libraryRepo.countReaders(db, book.id),
    ]);
  const reviewers = await profilesRepo.getProfileSummaries(
    db,
    reviewRows.map((r) => r.userId),
  );
  const ai = new Map(cached.map((c) => [c.action, c]));

  return {
    book: {
      id: book.id,
      slug: book.slug,
      title: book.title,
      author: book.author,
      authorSlug: book.authorSlug,
      coverUrl: book.coverUrl,
      publicationYear: book.publicationYear,
      readable: catalogRepo.isReadable(book),
      description: book.description,
      language: book.language,
      wordCount: book.wordCount,
      subjects: book.subjects ?? [],
      moodTags: book.moodTags ?? [],
      contentWarnings: book.contentWarnings ?? [],
      pacing: book.pacing,
      seriesName: book.seriesName,
      seriesOrder: book.seriesOrder,
      isbn13: book.isbn13,
      publisher: book.publisher,
      rating: book.weightedRating,
      ratingCount: book.ratingCount,
      community: book.sourceType === "community",
    },
    buys: buyLinks(book, affiliate),
    awards,
    related,
    moreByAuthor: byAuthor.filter((b) => b.id !== book.id).slice(0, 6),
    nextInSeries,
    ai: {
      description: cachedText(ai.get("book_description")),
      authorBio: cachedText(ai.get("author_bio")),
      similarBooks: cachedText(ai.get("similar_books")),
      readingOrder: cachedText(ai.get("reading_order")),
    },
    reviews: reviewRows.map((r) => ({
      id: r.id,
      author: reviewers.get(r.userId) ?? null,
      ratingHalf: r.ratingHalf,
      review: r.review ?? "",
      containsSpoilers: r.containsSpoilers,
      logDate: ms(r.logDate),
    })),
    clubs,
    popular: popular.map((p) => ({
      normalizedText: p.normalizedText,
      count: p.count,
      locator: p.locator,
    })),
    readerCount,
  };
}
