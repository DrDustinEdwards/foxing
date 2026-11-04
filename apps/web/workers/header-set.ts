// The security header set. site-runtime's site-runtime-headers bin writes public/_headers from the same registry entry,
// with the same TDMRep header, on every build. Foxing's deviations and their reasons are its entry in site-runtime's site registry (./sites,
// `foxing`); Prelum's TDMRep header goes beside it, reserving training rights as /ai.txt says.
import { TDM_RESERVATION_HEADERS } from "@drdustinedwards/site-helpers/robots";
import { buildSecurityHeaders } from "@dustinedwards/site-runtime/headers";
import { foxing } from "@dustinedwards/site-runtime/sites";

export const securityHeaders: Readonly<Record<string, string>> = Object.freeze({
  ...buildSecurityHeaders({ site: foxing }),
  ...TDM_RESERVATION_HEADERS,
});
