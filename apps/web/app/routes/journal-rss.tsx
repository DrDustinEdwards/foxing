import { catalogRepo } from "@foxing/core";
import { SITE_NAME, absoluteUrl, xmlEscape } from "~/lib/seo";
import { loaderBase } from "~/lib/loader.server";
import type { Route } from "./+types/journal-rss";

// Resource route (loader only, no component): serves the Journal RSS 2.0 feed.
export async function loader({ context, request }: Route.LoaderArgs) {
  const { db, origin } = loaderBase(context, request);
  const posts = await catalogRepo.listRssPosts(db, 30);
  const self = absoluteUrl(origin, "/journal/rss.xml");

  const items = posts
    .map((p) => {
      const link = absoluteUrl(origin, `/journal/${p.slug}`);
      const date = (p.publishedAt ?? p.createdAt).toUTCString();
      return `    <item>
      <title>${xmlEscape(p.title)}</title>
      <link>${xmlEscape(link)}</link>
      <guid isPermaLink="true">${xmlEscape(link)}</guid>
      <pubDate>${date}</pubDate>
      ${p.excerpt ? `<description>${xmlEscape(p.excerpt)}</description>` : ""}
    </item>`;
    })
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${SITE_NAME} Journal</title>
    <link>${xmlEscape(absoluteUrl(origin, "/journal"))}</link>
    <description>Essays and close readings from ${SITE_NAME}.</description>
    <language>en</language>
    <atom:link href="${xmlEscape(self)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=1800, stale-while-revalidate=86400",
    },
  });
}
