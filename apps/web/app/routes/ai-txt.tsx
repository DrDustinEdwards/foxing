import { aiTxtResponse } from "@drdustinedwards/site-helpers/robots";
import { HELLO_EMAIL, SITE_ORIGIN } from "~/lib/origins";
import { ROBOTS_DISALLOW } from "~/lib/seo";
import type { Route } from "./+types/ai-txt";

// The family's AI usage policy, Prelum's aiTxt served whole by aiTxtResponse: answer engines may cite and link,
// training rights are reserved (the TDMRep header in workers/security-headers.ts says the same) and licensed on request.
export function loader({ request }: Route.LoaderArgs) {
  return aiTxtResponse({
    origin: SITE_ORIGIN,
    request,
    name: "Foxing",
    contact: HELLO_EMAIL,
    disallow: ROBOTS_DISALLOW,
  });
}
