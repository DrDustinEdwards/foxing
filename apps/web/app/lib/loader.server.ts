// Shared loader plumbing for public catalog routes: the per-request Drizzle handle,
// the env, the request origin (for same-origin asset URLs; canonical and OG URLs use SITE_ORIGIN), and affiliate config.
import type { AffiliateConfig } from "@foxing/core";
import { createDb } from "@foxing/core";
import { publicPageHeaders } from "@dustinedwards/site-runtime/edge-cache";
import type { RouterContextProvider } from "react-router";
import { cloudflareContext } from "~/context";

export function loaderBase(context: Readonly<RouterContextProvider>, request: Request) {
  const { env, ctx } = context.get(cloudflareContext);
  return {
    env,
    ctx,
    db: createDb(env.DB, env.APP_KV),
    origin: new URL(request.url).origin,
  };
}

export function affiliateConfig(env: Env): AffiliateConfig {
  return {
    amazonTag: env.AMAZON_ASSOC_TAG || null,
    bookshopId: env.BOOKSHOP_AFFILIATE_ID || null,
  };
}

// The presets are site-runtime ./edge-cache publicPageHeaders: a page stored at the edge for
// `freshSeconds`, then served stale up to `staleSeconds` more while it re-renders, tagged "pages" so
// Carrel's and the admin API's writes purge it (workers/app.ts). Never kept in a browser.

/** Catalog pages (books, authors, book of the month): an hour at the edge, a day stale. */
export const catalogPageHeaders = () =>
  publicPageHeaders({ freshSeconds: 3600, staleSeconds: 86400 });
/** Pages that change rarely (about, terms, guides, awards, picks): an hour, a week stale. */
export const staticPageHeaders = () =>
  publicPageHeaders({ freshSeconds: 3600, staleSeconds: 604800 });
/** The journal and the marketing home: ten minutes at the edge, a day stale. */
export const listingPageHeaders = () =>
  publicPageHeaders({ freshSeconds: 600, staleSeconds: 86400 });
