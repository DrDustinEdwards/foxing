import { submitIndexNow } from "@drdustinedwards/site-helpers/indexnow";
import { sha256Hex } from "@dustinedwards/site-runtime/encoding";
import { SITE_ORIGIN } from "./origins";

// IndexNow: tells Bing/Yandex/Seznam (and any other participating engine) about URL
// changes instead of waiting for a crawl. The key is a fixed, non-secret token; the
// verification file at /<key>.txt must serve the key as its entire body.
export const INDEXNOW_KEY = "00684e0087cdfeb65e76fa0b88d1c4e0";

/**
 * Submit the current URL set to IndexNow through Prelum's submitIndexNow, which sends
 * nothing when `from` (the request that built the sitemap) is not on https://foxing.app,
 * keeps only foxing.app URLs and never throws. Callers should only invoke this when the
 * set actually changed (see sitemap.tsx's KV-hash check) and should fire it via
 * ctx.waitUntil so it never blocks the response.
 */
export async function pingIndexNow(from: string, urls: string[]): Promise<void> {
  await submitIndexNow({ origin: SITE_ORIGIN, key: INDEXNOW_KEY, urls, from });
}

/** Cheap, stable hash of the URL set, used to detect a real sitemap change in KV. */
export function hashUrls(urls: string[]): Promise<string> {
  return sha256Hex(urls.slice().sort().join("\n"));
}
