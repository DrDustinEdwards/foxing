// The satori pipeline both OG image routes share: the fonts, the PNG render and the
// edge cache. Each route builds its own card HTML and cache key.
import { ImageResponse } from "workers-og";
import { edgeCache } from "~/lib/cache.server";
import { FONT_CACHE_ORIGIN } from "~/lib/origins";

const WIDTH = 1200;
const HEIGHT = 630;

/**
 * Load a font satori can use. A legacy UA makes Google Fonts serve WOFF (satori
 * supports ttf/otf/woff, not woff2). Cached at the edge for a year.
 */
async function loadFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  const key = `${FONT_CACHE_ORIGIN}/${family}-${weight}.font`;
  const cache = edgeCache();
  const hit = await cache.match(key);
  if (hit) return hit.arrayBuffer();
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`,
      { headers: { "User-Agent": "Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1)" } },
    ).then((r) => r.text());
    const url = css.match(
      /src:\s*url\((.+?)\)\s*format\(['"]?(?:woff|truetype|opentype)['"]?\)/,
    )?.[1];
    if (!url) return null;
    const buf = await fetch(url).then((r) => r.arrayBuffer());
    await cache.put(
      key,
      new Response(buf, { headers: { "Cache-Control": "public, max-age=31536000" } }),
    );
    return buf;
  } catch {
    return null;
  }
}

type OgFonts = [display: ArrayBuffer | null, ui: ArrayBuffer | null];

/** Fraunces 600 for display and DM Sans 500 for UI; null for a face that failed to load. */
export function loadOgFonts(): Promise<OgFonts> {
  return Promise.all([loadFont("Fraunces", 600), loadFont("DM Sans", 500)]);
}

/**
 * Render the card to a PNG and cache it under `cacheKey`, or null when the render
 * fails. The PNG is materialized so a render error is caught here (satori/resvg run async).
 */
export async function renderOgPng(
  html: string,
  [display, ui]: OgFonts,
  cacheKey: Request,
): Promise<Response | null> {
  const fonts = [
    display
      ? { name: "Fraunces", data: display, weight: 600 as const, style: "normal" as const }
      : null,
    ui ? { name: "DM Sans", data: ui, weight: 500 as const, style: "normal" as const } : null,
  ].filter((f): f is NonNullable<typeof f> => f !== null);

  try {
    const image = new ImageResponse(html, { width: WIDTH, height: HEIGHT, fonts });
    const png = await new Response(image.body).arrayBuffer();
    const response = new Response(png, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=0, s-maxage=604800, immutable",
      },
    });
    await edgeCache().put(cacheKey, response.clone());
    return response;
  } catch {
    return null;
  }
}
