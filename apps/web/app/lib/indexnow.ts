// IndexNow: tells Bing/Yandex/Seznam (and any other participating engine) about URL
// changes instead of waiting for a crawl. The key is a fixed, non-secret token; the
// verification file at /<key>.txt must serve the key as its entire body.
export const INDEXNOW_KEY = "00684e0087cdfeb65e76fa0b88d1c4e0";

/**
 * Submit the current URL set to IndexNow. Callers should only invoke this when the
 * set actually changed (see sitemap.tsx's KV-hash check) and should fire it via
 * ctx.waitUntil so it never blocks the response.
 */
export async function pingIndexNow(origin: string, urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  const host = new URL(origin).host;
  try {
    await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        host,
        key: INDEXNOW_KEY,
        keyLocation: `${origin}/${INDEXNOW_KEY}.txt`,
        urlList: urls,
      }),
    });
  } catch {
    // Best-effort notification; a failed ping never affects the sitemap response.
  }
}

/** Cheap, stable hash of the URL set, used to detect a real sitemap change in KV. */
export async function hashUrls(urls: string[]): Promise<string> {
  const data = new TextEncoder().encode(urls.slice().sort().join("\n"));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
