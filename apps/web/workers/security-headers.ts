// Every security header Foxing sends: the shared package's set (the OWASP Secure Headers Project's
// own values, @dustinedwards/site-runtime, with Foxing's registry entry; ./header-set.ts) and the
// Content-Security-Policy built from the list below of what Foxing really loads. workers/app.ts calls withSecurityHeaders on every response, redirects, API, errors and cache
// hits included. No other file sets a security header.
import type { CspSources, SitePolicy } from "@dustinedwards/site-runtime/csp";
import { pageSecurity } from "@dustinedwards/site-runtime/page-headers";
import { TURNSTILE_ORIGIN } from "@dustinedwards/site-runtime/turnstile";
import { COVER_ORIGIN } from "../app/lib/origins";
import { securityHeaders } from "./header-set";
import { TRUSTED_TYPES_NAMES } from "@dustinedwards/site-runtime/trusted-types";

/**
 * What Foxing loads beyond its own origin, read from the code (2026-10-20):
 * - img: covers.foxing.app, the R2 custom domain every cover_url names, for a Journal cover pasted
 *   from there; pages show covers through /media/covers/ (app/lib/images.ts). Avatars are profiles.avatar_url, empty in
 *   production today; one on another host would be blocked (an empty avatar circle) until it is
 *   moved to R2 or its host is listed here.
 * - script, frame: Cloudflare Turnstile on the email sign-in link (site-runtime ./turnstile).
 * - connect: nothing beyond 'self', which covers /api/v1, /api/auth and the club-room WebSocket
 *   (same host, wss).
 * The Cloudflare Web Analytics beacon is asked for by name below (cloudflareWebAnalytics).
 */
const SITE_SOURCES: CspSources = {
  script: [TURNSTILE_ORIGIN],
  img: [COVER_ORIGIN],
  frame: [TURNSTILE_ORIGIN],
};

/** The site policy for this response: its nonce when it is a rendered page, none otherwise. */
function sitePolicy(nonce?: string): SitePolicy {
  return {
    sources: SITE_SOURCES,
    nonce,
    // React style={{...}} props render style="" attributes, which a nonce cannot cover.
    styleAttributesInline: true,
    cloudflareWebAnalytics: true,
    trustedTypes: TRUSTED_TYPES_NAMES,
  };
}

/** The reader, /read/:slug, a document of its own (app/routes/read.tsx loads it by full navigation). */
function isReaderPath(pathname: string): boolean {
  return pathname.startsWith("/read/");
}

/**
 * The reader's policy: the site policy with what Readium needs, and nothing looser for scripts.
 * Readium renders each EPUB resource into a blob: frame that inherits this policy, puts a <base>
 * in it pointing at /reader-assets so the book's images and CSS resolve, and loads ReadiumCSS as
 * blob: stylesheets beside the book's own <style> blocks, plus <style> elements in the page itself.
 * So: frames from blob:, base-uri 'self' (not 'none'), and styles from blob: and inline (which a
 * nonce on style-src would switch off, so styles carry none here; styles run no code). Scripts
 * keep the nonce and 'self' only: Readium's own frame scripts are given the nonce
 * (app/lib/reader/engine.client.ts), so an EPUB's inline scripts stay blocked, and its script
 * files are served as text/plain (workers/app.ts, /reader-assets), which nosniff refuses to run. Images also from data:
 * and blob:, which EPUBs and Readium use.
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

// The glue every site shares (site-runtime ./page-headers): the header set beside the policy, its Report-Only companion
// and Reporting-Endpoints, Cross-Origin-Resource-Policy by type, and a fresh nonce per reader for a page the edge cache
// stored. A route's own Content-Security-Policy wins. Trusted Types is enforced in both policies above; what the registry
// entry still stages (default-src 'none') rides Report-Only beside the policy.
const page = pageSecurity({
  set: securityHeaders,
  // The reader's policy is for the document /read/:slug renders; a response with no nonce is not that document.
  policy: ({ nonce, url }) =>
    nonce !== undefined && isReaderPath(url.pathname) ? readerPolicy(nonce) : sitePolicy(nonce),
  staged: { denyUnlisted: true },
  corp: true,
  renew: true,
});

/** The response with Foxing's headers; the shared Worker (workers/app.ts) runs it on every response it sends, with the
 *  nonce each page was rendered with. Reports go to its /csp-report sink. */
export const withSecurityHeaders = page.withSecurityHeaders;
