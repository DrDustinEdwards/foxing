import { catalogRepo, clubsRepo, profilesRepo } from "@foxing/core";
import { loaderBase } from "~/lib/loader.server";
import type { Route } from "./+types/search-suggest";

// JSON resource route powering search-as-you-type: the SearchBox uses `books`, the
// command palette federates books + authors + people + clubs. Only public profiles and
// public clubs are returned, so this stays safe to serve on the anonymous edge cache.
export async function loader({ context, request }: Route.LoaderArgs) {
  const { db } = loaderBase(context, request);
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const enough = q.trim().length >= 2;
  const [books, authors, people, clubs] = enough
    ? await Promise.all([
        catalogRepo.suggest(db, q, 6),
        catalogRepo.searchAuthors(db, q, 4),
        profilesRepo.searchProfiles(db, q, 4),
        clubsRepo.searchClubs(db, q, 4),
      ])
    : [[], [], [], []];
  return Response.json(
    {
      books: books.map((b) => ({ id: b.id, slug: b.slug, title: b.title, author: b.author })),
      authors: authors.map((a) => ({
        slug: a.authorSlug,
        name: a.author,
        bookCount: a.bookCount,
      })),
      people: people.map((p) => ({
        username: p.username,
        displayName: p.displayName ?? p.username,
      })),
      clubs: clubs.map((c) => ({ slug: c.slug, name: c.name })),
    },
    { headers: { "Cache-Control": "public, max-age=30, s-maxage=300" } },
  );
}
