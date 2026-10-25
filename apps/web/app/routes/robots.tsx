import { robotsDocument } from "@drdustinedwards/site-helpers/robots";
import { SITE_ORIGIN } from "~/lib/origins";
import { ROBOTS_DISALLOW } from "~/lib/seo";
import type { Route } from "./+types/robots";

// The family's one bot policy, from Prelum: search engines, AI search agents and training
// crawlers allowed (Cloudflare's Pay Per Crawl charges or blocks the training ones), Bytespider
// denied. The workers.dev preview is told `Disallow: /`.
export function loader({ request }: Route.LoaderArgs) {
  const body = robotsDocument({
    origin: SITE_ORIGIN,
    disallow: ROBOTS_DISALLOW,
    notes: [`AI usage policy: ${SITE_ORIGIN}/ai.txt`, `LLM guide: ${SITE_ORIGIN}/llms.txt`],
    preview: new URL(request.url).origin !== SITE_ORIGIN,
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=86400",
    },
  });
}
