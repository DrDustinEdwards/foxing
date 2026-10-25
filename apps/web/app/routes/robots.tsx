import { robotsDocument } from "@drdustinedwards/site-helpers/robots";
import { SITE_ORIGIN } from "~/lib/origins";
import type { Route } from "./+types/robots";

// The family's one bot policy, from Prelum: search engines, AI search agents and training
// crawlers allowed (Cloudflare's Pay Per Crawl charges or blocks the training ones), Bytespider
// denied. The workers.dev preview is told `Disallow: /`.
export function loader({ request }: Route.LoaderArgs) {
  const body = robotsDocument({
    origin: SITE_ORIGIN,
    disallow: ["/me", "/onboarding", "/search", "/companion-test"],
    preview: new URL(request.url).origin !== SITE_ORIGIN,
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=86400",
    },
  });
}
