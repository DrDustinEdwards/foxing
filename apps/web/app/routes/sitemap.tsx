import { type SitemapEntry, sitemapDocument } from "@drdustinedwards/site-helpers/sitemap";
import { catalogRepo } from "@foxing/core";
import { absoluteUrl, journalTagPath } from "~/lib/seo";
import { catalogPageHeaders, loaderBase } from "~/lib/loader.server";
import type { Route } from "./+types/sitemap";

// Sitemap over live catalog data. Catalog books only (source_type='catalog');
// community books are excluded by the repository queries, never listed here.
export async function loader({ context, request }: Route.LoaderArgs) {
  const { db } = loaderBase(context, request);

  const [books, authors, awards, clubs, posts, tags] = await Promise.all([
    catalogRepo.listSitemapBooks(db),
    catalogRepo.listAuthorSlugs(db),
    catalogRepo.listAwards(db),
    catalogRepo.listExternalClubs(db),
    catalogRepo.listPublishedSlugs(db),
    catalogRepo.listTags(db),
  ]);

  // Paths here; Prelum's sitemapDocument takes absolute URLs, made below.
  const urls: SitemapEntry[] = [
    { loc: "/", priority: 1 },
    { loc: "/books", priority: 0.9 },
    { loc: "/awards", priority: 0.7 },
    { loc: "/picks", priority: 0.7 },
    { loc: "/book-of-the-month", priority: 0.7 },
    { loc: "/journal", priority: 0.7 },
    { loc: "/journal/archive", priority: 0.5 },
    { loc: "/about", priority: 0.3 },
    { loc: "/features", priority: 0.4 },
    ...books.map((b) => ({
      loc: `/books/${b.slug}`,
      lastmod: b.updatedAt,
      priority: 0.8,
    })),
    ...authors.map((slug) => ({ loc: `/authors/${slug}`, priority: 0.6 })),
    ...awards.map((a) => ({ loc: `/awards/${a.slug}`, priority: 0.5 })),
    ...clubs.map((c) => ({ loc: `/picks/${c.slug}`, priority: 0.5 })),
    ...posts.map((p) => ({
      loc: `/journal/${p.slug}`,
      lastmod: p.updatedAt,
      priority: 0.6,
    })),
    ...tags.map((t) => ({ loc: journalTagPath(t.tag), priority: 0.4 })),
  ];

  // Expanded: the compact layout writes no <priority>.
  const body = sitemapDocument(
    urls.map((u) => ({ ...u, loc: absoluteUrl(u.loc) })),
    { layout: "expanded" },
  );

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      ...catalogPageHeaders(),
    },
  });
}
