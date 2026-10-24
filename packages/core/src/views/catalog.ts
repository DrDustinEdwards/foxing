// Catalog views: public reads of books, authors and search in their /api/v1 wire
// shape (@foxing/types). Nothing here depends on the viewer, so every one of them is
// safe to cache at the edge.
import type * as W from "@foxing/types";
import type { Db } from "../db";
import * as catalogRepo from "../repositories/catalog";
import * as clubsRepo from "../repositories/clubs";
import * as profilesRepo from "../repositories/profiles";

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
