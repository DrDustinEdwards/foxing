// Shared loader plumbing for public catalog routes: the per-request Drizzle handle,
// the env, the request origin (for canonical/OG URLs), and affiliate config.
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

/** Cache-Control for public catalog pages: short edge TTL + long stale-while-revalidate. */
export function publicCacheHeaders(sMaxAge = 3600, swr = 86400): HeadersInit {
  return {
    "Cache-Control": `public, max-age=0, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`,
  };
}
