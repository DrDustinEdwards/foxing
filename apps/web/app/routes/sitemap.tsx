import { kvPageRecord } from "@drdustinedwards/site-helpers/lastmod";
import { type SitemapEntry, sitemapDocument } from "@drdustinedwards/site-helpers/sitemap";
import { catalogRepo, views } from "@foxing/core";
import { hashUrls, pingIndexNow } from "~/lib/indexnow";
import { PAGE_DATES_KEY, TRACKED_PAGES } from "~/lib/page-dates";
import { absoluteUrl, journalTagPath } from "~/lib/seo";
import { catalogPageHeaders, loaderBase } from "~/lib/loader.server";
import type { Route } from "./+types/sitemap";
import { parseFilters } from "./books";

const SITEMAP_HASH_KEY = "indexnow:sitemap-hash";

// Sitemap over live catalog data. Catalog books only (source_type='catalog');
// community books are excluded by the repository queries, never listed here.
export async function loader({ context, request }: Route.LoaderArgs) {
  const { db, env, ctx } = loaderBase(context, request);

  const [books, authors, awards, clubs, posts, tags, homePick, homeBooks, browse, pageDates] =
    await Promise.all([
      catalogRepo.listSitemapBooks(db),
      catalogRepo.listSitemapAuthors(db),
      catalogRepo.listSitemapAwards(db),
      catalogRepo.listSitemapClubs(db),
      catalogRepo.listPublishedSlugs(db),
      catalogRepo.listSitemapTags(db),
      // The covers the home page and /books show, read as their loaders read them (marketing.tsx, books.tsx), for
      // their image entries.
      catalogRepo.getTodaysPick(db),
      catalogRepo.listBooks(db, { sort: "title", pageSize: 10 }),
      views.browse(db, parseFilters(new URL("/books", request.url))),
      // The hubs and the pages written in code have no row to date them: the daily page-dates job keeps the day each last changed.
      kvPageRecord(env.APP_KV, PAGE_DATES_KEY).load(),
    ]);
  const hub = (path: string) => ({ lastmod: pageDates?.[path]?.lastmod });
  const covers = (list: Array<{ coverUrl?: string | null } | null | undefined>) => {
    const urls = [...new Set(list.flatMap((b) => (b?.coverUrl ? [b.coverUrl] : [])))];
    return urls.length > 0 ? { images: urls } : {};
  };

  // Paths here; Prelum's sitemapDocument takes absolute URLs, made below.
  const urls: SitemapEntry[] = [
    { loc: "/", ...hub("/"), priority: 1, ...covers([homePick?.book, ...homeBooks.books]) },
    { loc: "/books", ...hub("/books"), priority: 0.9, ...covers(browse.books) },
    { loc: "/awards", ...hub("/awards"), priority: 0.7 },
    { loc: "/picks", ...hub("/picks"), priority: 0.7 },
    { loc: "/book-of-the-month", ...hub("/book-of-the-month"), priority: 0.7 },
    { loc: "/journal", ...hub("/journal"), priority: 0.7 },
    { loc: "/journal/archive", ...hub("/journal/archive"), priority: 0.5 },
    { loc: "/about", ...hub("/about"), priority: 0.3 },
    { loc: "/accessibility", ...hub("/accessibility"), priority: 0.3 },
    { loc: "/features", ...hub("/features"), priority: 0.4 },
    ...books.map((b) => ({
      loc: `/books/${b.slug}`,
      lastmod: b.updatedAt,
      priority: 0.8,
      ...(b.coverUrl ? { images: [b.coverUrl] } : {}),
    })),
    ...authors.map((a) => ({ loc: `/authors/${a.slug}`, lastmod: a.updatedAt, priority: 0.6 })),
    ...awards.map((a) => ({ loc: `/awards/${a.slug}`, lastmod: a.updatedAt, priority: 0.5 })),
    ...clubs.map((c) => ({ loc: `/picks/${c.slug}`, lastmod: c.updatedAt, priority: 0.5 })),
    ...posts.map((p) => ({
      loc: `/journal/${p.slug}`,
      lastmod: p.updatedAt,
      priority: 0.6,
    })),
    ...tags.map((t) => ({ loc: journalTagPath(t.tag), lastmod: t.updatedAt, priority: 0.4 })),
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
