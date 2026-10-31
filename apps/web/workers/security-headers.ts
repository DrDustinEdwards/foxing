// Every security header Foxing sends: the shared package's set (the OWASP Secure Headers Project's
// own values, @dustinedwards/site-runtime, with Foxing's registry entry; ./header-set.ts) and the
// Content-Security-Policy built from the list below of what Foxing really loads. workers/app.ts calls withSecurityHeaders on every response, redirects, API, errors and cache
// hits included. No other file sets a security header.
import { applyHeaderSet, corpFor } from "@dustinedwards/site-runtime/headers";
import {
  CSP_REPORT_PATH,
  buildContentSecurityPolicy,
  buildStagedPolicy,
  generateNonce,
  renewNonce,
  reportingEndpoints,
  type CspSources,
} from "@dustinedwards/site-runtime/csp";
import { receiveCspReport } from "@dustinedwards/site-runtime/csp-report";
import { ipKey, limit } from "@dustinedwards/site-runtime/rate-limit";
import { TURNSTILE_ORIGIN } from "@dustinedwards/site-runtime/turnstile";
import { COVER_ORIGIN } from "../app/lib/origins";
import { securityHeaders } from "./header-set";

/** Where browsers send violation reports (report-uri, the shared /csp-report), and the Reporting
 *  API name for it (report-to). Pages cached before the move still name the old path, which
 *  workers/app.ts keeps receiving. */
export { CSP_REPORT_PATH };
export const OLD_CSP_REPORT_PATH = "/api/csp-report";
const CSP_ENDPOINT_NAME = "csp-endpoint";

/**
 * What the next policy adds, sent Report-Only beside the enforced one (Foxing's registry entry
 * stages both): Trusted Types, which React DOM 19's innerHTML writes would trip today, and
 * default-src 'none', which shows each kind a page loads that the policy does not name. The
 * reports name what to fix before either is enforced.
 */
const STAGED = { trustedTypes: ["default"], denyUnlisted: true };

/**
 * What Foxing loads beyond its own origin, read from the code (2026-10-20):
 * - img: covers.foxing.app, the R2 custom domain every cover_url names, for a Journal cover pasted
 *   from there; pages show covers through /media/covers/ (app/lib/images.ts). Avatars are profiles.avatar_url, empty in
 *   production today; one on another host would be blocked (an empty avatar circle) until it is
 *   moved to R2 or its host is listed here.
 * - script, frame: Cloudflare Turnstile on the email sign-in link (site-runtime ./turnstile).
 * - connect: nothing beyond 'self', which covers /api/v1, /api/auth and the club-room WebSocket
 *   (same host, wss). Supabase is the mobile app's alone and is not listed.
 * The Cloudflare Web Analytics beacon is asked for by name below (cloudflareWebAnalytics).
 */
const SITE_SOURCES: CspSources = {
  script: [TURNSTILE_ORIGIN],
  img: [COVER_ORIGIN],
  frame: [TURNSTILE_ORIGIN],
};

/** The site policy's options for this response: its nonce when it is a rendered page. */
function sitePolicy(nonce?: string) {
  return {
    sources: SITE_SOURCES,
    nonce,
    // React style={{...}} props render style="" attributes, which a nonce cannot cover.
    styleAttributesInline: true,
    cloudflareWebAnalytics: true,
    reportUri: CSP_REPORT_PATH,
    reportTo: CSP_ENDPOINT_NAME,
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
export function readerContentSecurityPolicy(nonce?: string): string {
  return buildContentSecurityPolicy(readerPolicy(nonce)).value;
}

function readerPolicy(nonce?: string) {
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
    reportUri: CSP_REPORT_PATH,
    reportTo: CSP_ENDPOINT_NAME,
  };
}

// One nonce per request, issued to the render (app/entry.server.tsx, app/root.tsx via
// cspNonceContext) and read back here when the response leaves.
const issued = new WeakMap<Request, string>();

/** This request's nonce, made on first ask. The page render and its header share it. */
export function cspNonceFor(request: Request): string {
  let nonce = issued.get(request);
  if (!nonce) {
    nonce = generateNonce();
    issued.set(request, nonce);
  }
  return nonce;
}

const NONCE_IN_POLICY = /'nonce-([A-Za-z0-9+/_=-]+)'/;

function isHtml(headers: Headers): boolean {
  return (headers.get("Content-Type") ?? "").toLowerCase().includes("text/html");
}

/**
 * The response with Foxing's headers. A page from the edge cache still carries the nonce it was rendered with;
 * site-runtime's renewNonce gives it a fresh one per reader, rewriting only the elements that carry the old value, so
 * no two readers share a nonce and no injected element gains one. Cross-Origin-Resource-Policy follows the type
 * (corpFor): the OG cards and covers other sites embed are cross-origin, pages and JSON same-origin.
 */
export function withSecurityHeaders(response: Response, request: Request): Response {
  // A WebSocket upgrade carries its socket on the Response and cannot be rebuilt.
  if (response.status === 101) return response;

  const rendered = NONCE_IN_POLICY.exec(response.headers.get("Content-Security-Policy") ?? "")?.[1];
  if (isHtml(response.headers) && rendered && rendered !== issued.get(request)) {
    const fresh = generateNonce();
    issued.set(request, fresh);
    response = renewNonce(response, fresh);
  }
  const headers = new Headers(response.headers);
  const html = isHtml(headers);
  applyHeaderSet(headers, securityHeaders);
  headers.set("Cross-Origin-Resource-Policy", corpFor(headers.get("Content-Type")));
  const nonce = html ? issued.get(request) : undefined;
  const url = new URL(request.url);
  const reader = html && isReaderPath(url.pathname);
  const policy = reader ? readerPolicy(nonce) : sitePolicy(nonce);
  headers.set("Content-Security-Policy", buildContentSecurityPolicy(policy).value);
  const staged = buildStagedPolicy(policy, STAGED);
  headers.set(staged.name, staged.value);
  const reportUrl = new URL(CSP_REPORT_PATH, url);
  headers.set("Reporting-Endpoints", reportingEndpoints(CSP_ENDPOINT_NAME, reportUrl));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** Reports one address may send a minute before the rest are dropped (still 204). */
const CSP_REPORTS_PER_MINUTE = 20;

/**
 * The report sink: the family's one receiver (@dustinedwards/site-runtime/csp-report). It answers
 * every POST 204, reads at most 16 KB, logs at most 10 violations as trimmed JSON lines (origin and
 * path only; no address, user agent or cookie) and stores nothing. Per address, on its own
 * `csp-report` bucket of the RATE_LIMITER Durable Object, so it never spends a reader's write or
 * companion budget. It fails open: a limiter outage costs only log lines.
 */
export function handleCspReport(request: Request, env: Env): Promise<Response> {
  const allow = async (r: Request) => {
    const verdict = await limit(
      env.RATE_LIMITER,
      ipKey("csp-report", r).key,
      [{ limit: CSP_REPORTS_PER_MINUTE, windowSeconds: 60 }],
      { onUnavailable: "allow" },
    );
    return verdict.status !== "limited";
  };
  return receiveCspReport(request, { headers: securityHeaders, allow });
}
