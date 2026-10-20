import { catalogRepo } from "@foxing/core";
import { hashUrls, pingIndexNow } from "~/lib/indexnow";
import { absoluteUrl, journalTagPath, xmlEscape } from "~/lib/seo";
import { loaderBase } from "~/lib/loader.server";
import type { Route } from "./+types/sitemap";

type Url = { loc: string; lastmod?: string; priority?: string };

function urlTag(origin: string, u: Url): string {
  return `  <url><loc>${xmlEscape(absoluteUrl(origin, u.loc))}</loc>${
    u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""
  }${u.priority ? `<priority>${u.priority}</priority>` : ""}</url>`;
}

const SITEMAP_HASH_KEY = "indexnow:sitemap-hash";

// Sitemap over live catalog data. Catalog books only (source_type='catalog');
// community books are excluded by the repository queries, never listed here.
export async function loader({ context, request }: Route.LoaderArgs) {
  const { db, env, ctx, origin } = loaderBase(context, request);

  const [books, authors, awards, clubs, posts, tags] = await Promise.all([
    catalogRepo.listSitemapBooks(db),
    catalogRepo.listAuthorSlugs(db),
    catalogRepo.listAwards(db),
    catalogRepo.listExternalClubs(db),
    catalogRepo.listPublishedSlugs(db),
    catalogRepo.listTags(db),
  ]);

  const urls: Url[] = [
    { loc: "/", priority: "1.0" },
    { loc: "/books", priority: "0.9" },
    { loc: "/awards", priority: "0.7" },
    { loc: "/picks", priority: "0.7" },
    { loc: "/book-of-the-month", priority: "0.7" },
    { loc: "/journal", priority: "0.7" },
    { loc: "/journal/archive", priority: "0.5" },
    { loc: "/about", priority: "0.3" },
    { loc: "/features", priority: "0.4" },
    ...books.map((b) => ({
      loc: `/books/${b.slug}`,
      lastmod: b.updatedAt.toISOString().slice(0, 10),
      priority: "0.8",
    })),
    ...authors.map((slug) => ({ loc: `/authors/${slug}`, priority: "0.6" })),
    ...awards.map((a) => ({ loc: `/awards/${a.slug}`, priority: "0.5" })),
    ...clubs.map((c) => ({ loc: `/picks/${c.slug}`, priority: "0.5" })),
    ...posts.map((p) => ({
      loc: `/journal/${p.slug}`,
      lastmod: p.updatedAt.toISOString().slice(0, 10),
      priority: "0.6",
    })),
    ...tags.map((t) => ({ loc: journalTagPath(t.tag), priority: "0.4" })),
  ];

  // IndexNow: ping only when the URL set actually changed since the last sitemap
  // request (tracked in KV; no cron infra exists to run this on a schedule). Never
  // blocks the response.
  ctx.waitUntil(
    (async () => {
      const currentHash = await hashUrls(urls.map((u) => u.loc));
      const previousHash = await env.APP_KV.get(SITEMAP_HASH_KEY);
      if (currentHash === previousHash) return;
      await env.APP_KV.put(SITEMAP_HASH_KEY, currentHash);
      await pingIndexNow(
        origin,
        urls.map((u) => absoluteUrl(origin, u.loc)),
      );
    })(),
  );

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => urlTag(origin, u)).join("\n")}
</urlset>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
