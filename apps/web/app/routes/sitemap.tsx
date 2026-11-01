import { type SitemapEntry, sitemapDocument } from "@drdustinedwards/site-helpers/sitemap";
import { catalogRepo, views } from "@foxing/core";
import { hashUrls, pingIndexNow } from "~/lib/indexnow";
import { absoluteUrl, journalTagPath } from "~/lib/seo";
import { catalogPageHeaders, loaderBase } from "~/lib/loader.server";
import type { Route } from "./+types/sitemap";
import { parseFilters } from "./books";

const SITEMAP_HASH_KEY = "indexnow:sitemap-hash";

// Sitemap over live catalog data. Catalog books only (source_type='catalog');
// community books are excluded by the repository queries, never listed here.
export async function loader({ context, request }: Route.LoaderArgs) {
  const { db, env, ctx } = loaderBase(context, request);

  const [books, authors, awards, clubs, posts, tags, homePick, homeBooks, browse] =
    await Promise.all([
      catalogRepo.listSitemapBooks(db),
      catalogRepo.listAuthorSlugs(db),
      catalogRepo.listAwards(db),
      catalogRepo.listExternalClubs(db),
      catalogRepo.listPublishedSlugs(db),
      catalogRepo.listTags(db),
      // The covers the home page and /books show, read as their loaders read them (marketing.tsx, books.tsx), for
      // their image entries.
      catalogRepo.getTodaysPick(db),
      catalogRepo.listBooks(db, { sort: "title", pageSize: 10 }),
      views.browse(db, parseFilters(new URL("/books", request.url))),
    ]);
  const covers = (list: Array<{ coverUrl?: string | null } | null | undefined>) => {
    const urls = [...new Set(list.flatMap((b) => (b?.coverUrl ? [b.coverUrl] : [])))];
    return urls.length > 0 ? { images: urls } : {};
  };

  // Paths here; Prelum's sitemapDocument takes absolute URLs, made below.
  const urls: SitemapEntry[] = [
    { loc: "/", priority: 1, ...covers([homePick?.book, ...homeBooks.books]) },
    { loc: "/books", priority: 0.9, ...covers(browse.books) },
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
      ...(b.coverUrl ? { images: [b.coverUrl] } : {}),
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

  // IndexNow: ping only when the URL set actually changed since the last sitemap
  // request (tracked in KV; no cron infra exists to run this on a schedule). Never
  // blocks the response. Journal posts are left out: a Carrel publish submits its post
  // at once (site-api's indexNowHook, lib/carrel/site-api.server.ts).
  const postLocs = new Set(posts.map((p) => `/journal/${p.slug}`));
  const pingUrls = urls.filter((u) => !postLocs.has(u.loc));
  ctx.waitUntil(
    (async () => {
      const currentHash = await hashUrls(pingUrls.map((u) => u.loc));
      const previousHash = await env.APP_KV.get(SITEMAP_HASH_KEY);
      if (currentHash === previousHash) return;
      await env.APP_KV.put(SITEMAP_HASH_KEY, currentHash);
      await pingIndexNow(
        request.url,
        pingUrls.map((u) => absoluteUrl(u.loc)),
      );
    })(),
  );

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
