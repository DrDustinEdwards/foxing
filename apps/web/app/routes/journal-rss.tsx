import { rssDocument } from "@drdustinedwards/site-helpers/feeds";
import { catalogRepo } from "@foxing/core";
import { SITE_ORIGIN } from "~/lib/origins";
import { SITE_NAME, absoluteUrl } from "~/lib/seo";
import { loaderBase, publicCacheHeaders } from "~/lib/loader.server";
import type { Route } from "./+types/journal-rss";

// Resource route (loader only, no component): serves the Journal RSS 2.0 feed (Prelum's rssDocument).
export async function loader({ context, request }: Route.LoaderArgs) {
  const { db } = loaderBase(context, request);
  const posts = await catalogRepo.listRssPosts(db, 30);

  const body = rssDocument({
    title: `${SITE_NAME} Journal`,
    link: absoluteUrl("/journal"),
    description: `Essays and close readings from ${SITE_NAME}.`,
    selfUrl: absoluteUrl("/journal/rss.xml"),
    origin: SITE_ORIGIN,
    itemPath: "/journal",
    posts: posts.map((p) => ({
      slug: p.slug,
      title: p.title,
      html: null,
      description: p.excerpt,
      publishAt: p.publishedAt ?? p.createdAt,
      tags: [],
    })),
  });

  return new Response(body, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      ...publicCacheHeaders(1800, 86400),
    },
  });
}
