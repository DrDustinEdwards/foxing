import { robotsResponse } from "@drdustinedwards/site-helpers/robots";
import { SITE_ORIGIN } from "~/lib/origins";
import { ROBOTS_DISALLOW } from "~/lib/seo";
import type { Route } from "./+types/robots";

// The family's one bot policy, from Prelum: search engines, AI search agents and training
// crawlers allowed (Cloudflare's Pay Per Crawl charges or blocks the training ones), Bytespider
// denied. The workers.dev preview is told `Disallow: /`.
export function loader({ request }: Route.LoaderArgs) {
  return robotsResponse({ origin: SITE_ORIGIN, request, disallow: ROBOTS_DISALLOW });
}
