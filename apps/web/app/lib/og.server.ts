// The share-card fonts and render the OG image routes share: Fraunces 600 for display and DM Sans 500 for UI, drawn by
// site-runtime's renderShareCard and kept at the edge under each route's key. Each route builds its own card HTML.
import { googleFont, renderShareCard } from "@dustinedwards/site-runtime/share-card";
import { ImageResponse } from "workers-og";
import { edgeCache } from "~/lib/cache.server";
import { FONT_CACHE_ORIGIN } from "~/lib/origins";

type OgFonts = [display: ArrayBuffer | null, ui: ArrayBuffer | null];

/** Fraunces 600 for display and DM Sans 500 for UI; null for a face that failed to load. */
export function loadOgFonts(): Promise<OgFonts> {
  const options = { cache: edgeCache(), cacheOrigin: FONT_CACHE_ORIGIN };
  return Promise.all([googleFont("Fraunces", 600, options), googleFont("DM Sans", 500, options)]);
}

/** Render the card to a PNG and cache it under `cacheKey`, or null when the render fails. */
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

  const png = await renderShareCard(ImageResponse, html, { fonts });
  if (png) await edgeCache().put(cacheKey, png.clone());
  return png;
}
