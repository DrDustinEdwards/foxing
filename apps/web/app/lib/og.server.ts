// The share-card fonts and route answer the OG image routes share (site-runtime's shareCardResponse); each route builds its own card HTML.
import { googleFont, shareCardResponse } from "@dustinedwards/site-runtime/share-card";
import { drawShareCard } from "@dustinedwards/site-runtime/share-card-draw";
import { edgeCache } from "~/lib/cache.server";
import { publicPageHeaders } from "@dustinedwards/site-runtime/edge-cache";
import { FONT_CACHE_ORIGIN } from "~/lib/origins";

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
  if (fonts.length === 0) throw new Error("no share-card font loaded");
  return { fonts, titleFamily: display ? ("Fraunces" as const) : ("DM Sans" as const) };
}

/** The card under `cacheKey` from the edge cache, else drawn from `build`'s HTML; a card that cannot be drawn is a 503 with Retry-After. */
export async function ogCard(
  cacheKey: Request,
  build: (fonts: OgCardFonts) => string | Promise<string>,
): Promise<Response> {
  let loaded: ReturnType<typeof loadOgFonts> | undefined;
  const fonts = () => {
    loaded ??= loadOgFonts();
    return loaded;
  };
  const card = await shareCardResponse(drawShareCard, {
    cacheKey,
    cache: edgeCache(),
    fonts: async () => (await fonts()).fonts,
    html: async () => build(await fonts()),
  });
  if (card.status !== 200) return card;
  // A public page too: stored a week, purged with the pages; set after the card is kept under its own key, which needs the zone cache's s-maxage.
  const headers = new Headers(card.headers);
  for (const [name, value] of Object.entries(
    publicPageHeaders({ freshSeconds: 604800, staleSeconds: 0 }),
  ))
    headers.set(name, value);
  return new Response(card.body, { status: card.status, headers });
}
