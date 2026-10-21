// Every security header Foxing sends, in one file: the shared package's standard set (the OWASP
// Secure Headers Project's own values, @dustinedwards/site-runtime) with this site's deviations, each
// beside its reason, and the Content-Security-Policy built from the list below of what Foxing really
// loads. workers/app.ts calls withSecurityHeaders on every response, redirects, API, errors and cache
// hits included. No other file sets a security header.
import { applyHeaderSet, buildSecurityHeaders } from "@dustinedwards/site-runtime/headers";
import {
  buildContentSecurityPolicy,
  buildPolicy,
  generateNonce,
  type CspSources,
} from "@dustinedwards/site-runtime/csp";
import { receiveCspReport } from "@dustinedwards/site-runtime/csp-report";
import { COVER_ORIGIN } from "../app/lib/origins";

/** Where browsers send violation reports (report-uri), and the Reporting API name for it (report-to). */
export const CSP_REPORT_PATH = "/api/csp-report";
const CSP_ENDPOINT_NAME = "csp-endpoint";

/**
 * What Foxing loads beyond its own origin, read from the code (2026-10-20):
 * - style, font: Google Fonts, the stylesheet link in app/root.tsx and the files it names.
 * - img: book covers, every one on the R2 custom domain covers.foxing.app (app/lib/images.ts; all
 *   2,209 cover_url rows in production D1 are on it). Avatars are profiles.avatar_url, empty in
 *   production today; one on another host would be blocked (an empty avatar circle) until it is
 *   moved to R2 or its host is listed here.
 * - script, frame: Cloudflare Turnstile on the auth forms (app/components/turnstile.tsx).
 * - connect: nothing beyond 'self', which covers /api/v1, /api/auth and the club-room WebSocket
 *   (same host, wss). Supabase is the mobile app's alone and is not listed.
 * The Cloudflare Web Analytics beacon is asked for by name below (cloudflareWebAnalytics).
 */
const SITE_SOURCES: CspSources = {
  script: ["https://challenges.cloudflare.com"],
  style: ["https://fonts.googleapis.com"],
  font: ["https://fonts.gstatic.com"],
  img: [COVER_ORIGIN],
  frame: ["https://challenges.cloudflare.com"],
};

/** The set every response carries. No deviation from the standard yet: none has been needed. */
export const securityHeaders: Readonly<Record<string, string>> = buildSecurityHeaders();

/**
 * Images only: the OG cards (/og/*, og.foxing.app) are embedded by other sites, and a link preview
 * that a browser loads straight from here would be refused under same-origin.
 */
const imageHeaders: Readonly<Record<string, string>> = buildSecurityHeaders({
  overrides: {
    "Cross-Origin-Resource-Policy": {
      value: "cross-origin",
      reason:
        "OG cards and other images are embedded by other sites' link previews; same-origin would block them in the reader's browser",
    },
  },
});

/** The site policy for this response: its nonce when it is a rendered page, none otherwise. */
export function contentSecurityPolicy(nonce?: string): string {
  return buildContentSecurityPolicy({
    sources: SITE_SOURCES,
    nonce,
    // React style={{...}} props render style="" attributes, which a nonce cannot cover.
    styleAttributesInline: true,
    cloudflareWebAnalytics: true,
    reportUri: CSP_REPORT_PATH,
    reportTo: CSP_ENDPOINT_NAME,
  }).value;
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
  const site = contentSecurityPolicy(nonce).split("; ");
  const replace: Record<string, string> = {
    "style-src": `style-src 'self' 'unsafe-inline' blob: ${(SITE_SOURCES.style ?? []).join(" ")}`,
    "style-src-attr": "",
    "img-src": `img-src 'self' data: blob: ${(SITE_SOURCES.img ?? []).join(" ")}`,
    "frame-src": "frame-src 'self' blob:",
    "base-uri": "base-uri 'self'",
  };
  return buildPolicy(
    site
      .map((d) => {
        const name = d.split(" ")[0] ?? "";
        return name in replace ? (replace[name] ?? "") : d;
      })
      .filter(Boolean),
  );
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
 * The response with Foxing's headers. A page from the edge cache still carries the nonce it was
 * rendered with; it is re-issued here, a fresh one per reader, by rewriting only the elements that
 * carry the old value, so no two readers share a nonce and no injected element gains one.
 */
export function withSecurityHeaders(response: Response, request: Request): Response {
  // A WebSocket upgrade carries its socket on the Response and cannot be rebuilt.
  if (response.status === 101) return response;

  const headers = new Headers(response.headers);
  let body = response.body;
  const html = isHtml(headers);
  applyHeaderSet(
    headers,
    html || !headers.get("Content-Type")?.startsWith("image/") ? securityHeaders : imageHeaders,
  );

  let nonce: string | undefined;
  if (html) {
    const rendered = NONCE_IN_POLICY.exec(headers.get("Content-Security-Policy") ?? "")?.[1];
    const current = issued.get(request);
    if (rendered && rendered !== current) {
      const fresh = generateNonce();
      issued.set(request, fresh);
      nonce = fresh;
      const rewrite = {
        element(el: Element) {
          if (el.getAttribute("nonce") === rendered) el.setAttribute("nonce", fresh);
        },
      };
      body = new HTMLRewriter()
        .on("script[nonce]", rewrite)
        .on("link[nonce]", rewrite)
        .on("style[nonce]", rewrite)
        .transform(new Response(body, { headers })).body;
    } else {
      nonce = current;
    }
  }
  const url = new URL(request.url);
  const reader = html && isReaderPath(url.pathname);
  headers.set(
    "Content-Security-Policy",
    reader ? readerContentSecurityPolicy(nonce) : contentSecurityPolicy(nonce),
  );
  // Absolute, because Reporting-Endpoints ignores a relative endpoint (as in Carrel and dustinedwards.info).
  headers.set("Reporting-Endpoints", `${CSP_ENDPOINT_NAME}="${url.origin}${CSP_REPORT_PATH}"`);
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}

/**
 * The report sink: the family's one receiver (@dustinedwards/site-runtime/csp-report). It answers
 * every POST 204, reads at most 16 KB, logs at most 10 violations as trimmed JSON lines (origin and
 * path only; no address, user agent or cookie) and stores nothing. No limiter is passed: the web
 * app's limiters are the auth, write and companion budgets, and spending a reader's login budget
 * on their browser's violation reports would be wrong.
 */
export function handleCspReport(request: Request): Promise<Response> {
  return receiveCspReport(request, { headers: securityHeaders });
}
