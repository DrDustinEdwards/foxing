// Every security header Foxing sends: the shared package's set (@dustinedwards/site-runtime, ./header-set.ts) and the
// CSP built from the list below. workers/app.ts calls withSecurityHeaders on every response; no other file sets one.
import type { CspSources, SitePolicy } from "@dustinedwards/site-runtime/csp";
import { pageSecurity } from "@dustinedwards/site-runtime/page-headers";
import { TURNSTILE_ORIGIN } from "@dustinedwards/site-runtime/turnstile";
import { COVER_ORIGIN } from "../app/lib/origins";
import { securityHeaders } from "./header-set";
import { TRUSTED_TYPES_NAMES } from "@dustinedwards/site-runtime/trusted-types";

/**
 * What Foxing loads beyond its own origin:
 * - img: covers.foxing.app (the R2 custom domain every cover_url names); an avatar on another host would be blocked.
 * - script, frame: Cloudflare Turnstile on the email sign-in link.
 * - connect: nothing beyond 'self' (/api/v1, /api/auth, the club-room WebSocket).
 * The Web Analytics beacon is asked for by name below (cloudflareWebAnalytics).
 */
const SITE_SOURCES: CspSources = {
  script: [TURNSTILE_ORIGIN],
  img: [COVER_ORIGIN],
  frame: [TURNSTILE_ORIGIN],
};

function sitePolicy(nonce?: string): SitePolicy {
  return {
    sources: SITE_SOURCES,
    nonce,
    styleAttributesInline: true,
    cloudflareWebAnalytics: true,
    trustedTypes: TRUSTED_TYPES_NAMES,
  };
}

function isReaderPath(pathname: string): boolean {
  return pathname.startsWith("/read/");
}

/**
 * The reader's policy: the site policy plus what Readium needs. Its blob: frames inherit it and carry a <base> to
 * /reader-assets, so: frames from blob:, base-uri 'self', styles from blob: and inline (a style-src nonce would switch
 * inline off; styles run no code). Scripts keep the nonce and 'self' only: Readium's frame scripts are given the nonce,
 * an EPUB's inline scripts stay blocked and its script files are served as text/plain. Images also from data: and blob:.
 */
function readerPolicy(nonce?: string): SitePolicy {
  return {
    sources: {
      ...SITE_SOURCES,
      style: ["'unsafe-inline'", "blob:", ...(SITE_SOURCES.style ?? [])],
      img: ["data:", "blob:", ...(SITE_SOURCES.img ?? [])],
      frame: ["blob:"],
    },
    nonce,
    nonceStyles: false,
    baseUriSelf: true,
    cloudflareWebAnalytics: true,
    trustedTypes: TRUSTED_TYPES_NAMES,
  };
}

// The shared glue (site-runtime ./page-headers): header set, Report-Only companion, Reporting-Endpoints, CORP by type and
// a fresh nonce per reader for an edge-cached page. A route's own CSP wins; what the registry still stages rides Report-Only.
const page = pageSecurity({
  set: securityHeaders,
  policy: ({ nonce, url }) =>
    nonce !== undefined && isReaderPath(url.pathname) ? readerPolicy(nonce) : sitePolicy(nonce),
  staged: { denyUnlisted: true },
  corp: true,
  renew: true,
});

/** The response with Foxing's headers and the nonce its page was rendered with; reports go to /csp-report. */
export const withSecurityHeaders = page.withSecurityHeaders;
