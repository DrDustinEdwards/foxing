import { absoluteUrl } from "~/lib/seo";
import type { Route } from "./+types/robots";

// robots.txt with an absolute sitemap URL (correct on preview and after cutover).
export function loader({ request }: Route.LoaderArgs) {
  const origin = new URL(request.url).origin;
  const body = `User-agent: *
Allow: /
Disallow: /me
Disallow: /onboarding
Disallow: /search
Disallow: /companion-test

Sitemap: ${absoluteUrl(origin, "/sitemap.xml")}
`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=86400",
    },
  });
}
