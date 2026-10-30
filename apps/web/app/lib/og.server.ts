// The share-card fonts and route answer the OG image routes share: Fraunces 600 for display and DM Sans 500 for UI,
// drawn and kept at the edge by site-runtime's shareCardResponse under each route's key. Each route builds its own
// card HTML.
import { googleFont, shareCardResponse } from "@dustinedwards/site-runtime/share-card";
import { ImageResponse } from "workers-og";
import { edgeCache } from "~/lib/cache.server";
import { FONT_CACHE_ORIGIN } from "~/lib/origins";

/** What a card's HTML needs to know about the fonts: the family its title can use. */
export type OgCardFonts = { titleFamily: "Fraunces" | "DM Sans" };

async function loadOgFonts() {
  const options = { cache: edgeCache(), cacheOrigin: FONT_CACHE_ORIGIN };
  const [display, ui] = await Promise.all([
    googleFont("Fraunces", 600, options),
    googleFont("DM Sans", 500, options),
  ]);
  const fonts = [
    display ? { name: "Fraunces", data: display, weight: 600, style: "normal" } : null,
    ui ? { name: "DM Sans", data: ui, weight: 500, style: "normal" } : null,
  ].filter((font) => font !== null);
  // No face loaded: refused here, so the route answers its fallback instead of a blank card.
  if (fonts.length === 0) throw new Error("no share-card font loaded");
  return { fonts, titleFamily: display ? ("Fraunces" as const) : ("DM Sans" as const) };
}

/**
 * The card under `cacheKey` from the edge cache, else drawn from `build`'s HTML and kept there. Fonts load, and
 * `build` runs, only on a miss. A card that cannot be drawn (no font, a render error) is a 503 with Retry-After.
 */
export function ogCard(
  cacheKey: Request,
  build: (fonts: OgCardFonts) => string | Promise<string>,
): Promise<Response> {
  let loaded: ReturnType<typeof loadOgFonts> | undefined;
  const fonts = () => {
    loaded ??= loadOgFonts();
    return loaded;
  };
  return shareCardResponse(ImageResponse, {
    cacheKey,
    cache: edgeCache(),
    fonts: async () => (await fonts()).fonts,
    html: async () => build(await fonts()),
  });
}
