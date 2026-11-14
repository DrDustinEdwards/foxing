import { kvPageRecord } from "@drdustinedwards/site-helpers/lastmod";
import { type SitemapEntry, sitemapResponse } from "@drdustinedwards/site-helpers/sitemap";
import { catalogRepo, views } from "@foxing/core";
import { submitIndexNowIfChanged } from "@drdustinedwards/site-helpers/indexnow";
import { INDEXNOW_KEY } from "~/lib/indexnow";
import { SITE_ORIGIN } from "~/lib/origins";
import { PAGE_DATES_KEY, TRACKED_PAGES } from "~/lib/page-dates";
import { absoluteUrl, journalSeriesPath, journalTagPath } from "~/lib/seo";
import { catalogPageHeaders, loaderBase } from "~/lib/loader.server";
import type { Route } from "./+types/sitemap";
import { parseFilters } from "./books";

const SITEMAP_HASH_KEY = "indexnow:sitemap-hash";

// Sitemap over live catalog data. Catalog books only (source_type='catalog');
// community books are excluded by the repository queries, never listed here.
export async function loader({ context, request }: Route.LoaderArgs) {
  const { db, env, ctx } = loaderBase(context, request);

  const [
    books,
    authors,
    awards,
    clubs,
    posts,
    tags,
    series,
    homePick,
    homeBooks,
    browse,
    pageDates,
  ] = await Promise.all([
    catalogRepo.listSitemapBooks(db),
    catalogRepo.listSitemapAuthors(db),
    catalogRepo.listSitemapAwards(db),
    catalogRepo.listSitemapClubs(db),
    catalogRepo.listPublishedSlugs(db),
    catalogRepo.listSitemapTags(db),
    catalogRepo.listSitemapSeries(db),
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

  // Paths here; Prelum's sitemapResponse takes absolute URLs, made below.
  const urls: SitemapEntry[] = [
    // The covers on the home page and /books go with those two entries.
    ...TRACKED_PAGES.map((loc) => ({
      loc,
      ...hub(loc),
      ...(loc === "/"
        ? covers([homePick?.book, ...homeBooks.books])
        : loc === "/books"
          ? covers(browse.books)
          : {}),
    })),
    ...books.map((b) => ({
      loc: `/books/${b.slug}`,
      lastmod: b.updatedAt,
      ...(b.coverUrl ? { images: [b.coverUrl] } : {}),
    })),
    ...authors.map((a) => ({ loc: `/authors/${a.slug}`, lastmod: a.updatedAt })),
    ...awards.map((a) => ({ loc: `/awards/${a.slug}`, lastmod: a.updatedAt })),
    ...clubs.map((c) => ({ loc: `/picks/${c.slug}`, lastmod: c.updatedAt })),
    ...posts.map((p) => ({
      loc: `/journal/${p.slug}`,
      lastmod: p.updatedAt,
    })),
    ...tags.map((t) => ({ loc: journalTagPath(t.tag), lastmod: t.updatedAt })),
    ...series.map((s) => ({
      loc: journalSeriesPath(s.series),
      lastmod: s.updatedAt,
    })),
  ];

  // IndexNow: ping only when the URL set changed since the last sitemap request
  // (Prelum keeps its hash in KV, written once the ping went). Never
  // blocks the response. Journal posts are left out: a Carrel publish submits its post
  // at once (site-api's indexNowHook, lib/carrel/site-api.server.ts).
  const postLocs = new Set(posts.map((p) => `/journal/${p.slug}`));
  const pingUrls = urls.filter((u) => !postLocs.has(u.loc));
  ctx.waitUntil(
    submitIndexNowIfChanged({
      kv: env.APP_KV,
      hashKey: SITEMAP_HASH_KEY,
      origin: SITE_ORIGIN,
      key: INDEXNOW_KEY,
      urls: pingUrls.map((u) => absoluteUrl(u.loc)),
      from: request.url,
    }),
  );

  return sitemapResponse(
    urls.map((u) => ({ ...u, loc: absoluteUrl(u.loc) })),
    { headers: catalogPageHeaders() },
  );
}
