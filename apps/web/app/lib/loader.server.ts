// Shared loader plumbing for public catalog routes: the per-request Drizzle handle,
// the env, the request origin (for same-origin asset URLs; canonical and OG URLs use SITE_ORIGIN), and affiliate config.
import type { AffiliateConfig } from "@foxing/core";
import { createDb } from "@foxing/core";
import type { RouterContextProvider } from "react-router";
import { cloudflareContext } from "~/context";

export function loaderBase(context: Readonly<RouterContextProvider>, request: Request) {
  const { env, ctx } = context.get(cloudflareContext);
  return {
    env,
    ctx,
    db: createDb(env.DB),
    origin: new URL(request.url).origin,
  };
}

export function affiliateConfig(env: Env): AffiliateConfig {
  return {
    amazonTag: env.AMAZON_ASSOC_TAG || null,
    bookshopId: env.BOOKSHOP_AFFILIATE_ID || null,
  };
}

/** Cache-Control for public pages: short edge TTL + long stale-while-revalidate. */
export function publicCacheHeaders(sMaxAge: number, swr: number) {
  return {
    "Cache-Control": `public, max-age=0, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`,
  };
}

/** Catalog pages (books, authors, book of the month): an hour at the edge, a day stale. */
export const catalogPageHeaders = () => publicCacheHeaders(3600, 86400);
/** Pages that change rarely (about, terms, guides, awards, picks): an hour, a week stale. */
export const staticPageHeaders = () => publicCacheHeaders(3600, 604800);
/** The journal and the marketing home: ten minutes at the edge, a day stale. */
export const listingPageHeaders = () => publicCacheHeaders(600, 86400);
