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

// Presets of site-runtime's publicPageHeaders: stored at the edge for `freshSeconds`, then stale for `staleSeconds`, tagged "pages" so Carrel's and the admin API's writes purge it.

export const catalogPageHeaders = () =>
  publicPageHeaders({ freshSeconds: 3600, staleSeconds: 86400 });
export const staticPageHeaders = () =>
  publicPageHeaders({ freshSeconds: 3600, staleSeconds: 604800 });
export const listingPageHeaders = () =>
  publicPageHeaders({ freshSeconds: 600, staleSeconds: 86400 });
