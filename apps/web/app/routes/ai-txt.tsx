import { aiTxt } from "@drdustinedwards/site-helpers/robots";
import { HELLO_EMAIL, SITE_ORIGIN } from "~/lib/origins";
import { ROBOTS_DISALLOW } from "~/lib/seo";

// The family's AI usage policy, from Prelum: answer engines may cite and link, training rights are
// reserved (the TDMRep header in workers/security-headers.ts says the same) and licensed on request.
export function loader() {
  return new Response(
    aiTxt({ origin: SITE_ORIGIN, name: "Foxing", contact: HELLO_EMAIL, disallow: ROBOTS_DISALLOW }),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=0, s-maxage=86400",
      },
    },
  );
}
