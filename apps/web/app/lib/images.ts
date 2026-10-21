// Cloudflare Image Transformations in front of R2 covers.
//
// Covers are served from the R2 custom domain covers.foxing.app (already live).
// When Image Transformations is enabled on the foxing.app zone, we can request
// resized/reformatted variants via the /cdn-cgi/image/<options>/<path> URL form,
// same origin. AVIF/WebP negotiation is automatic with format=auto.
//
// Gating: VITE_IMAGES_TRANSFORM. Default OFF so the workers.dev preview (and any
// environment where the zone feature is not yet enabled) serves the raw R2 URL and
// never shows a broken /cdn-cgi/image 404. Flip to "true" once Transformations is
// enabled on the zone (dashboard step), then rebuild + deploy.
import { COVER_ORIGIN } from "./origins";

const TRANSFORM = import.meta.env.VITE_IMAGES_TRANSFORM === "true";

/** The responsive widths we render covers at (1x/2x for the common display sizes). */
export const COVER_WIDTHS = [160, 240, 320, 400, 480, 640] as const;

function transform(src: string, options: string): string {
  if (!TRANSFORM) return src;
  try {
    const u = new URL(src);
    if (u.origin !== COVER_ORIGIN) return src; // only our covers zone
    return `${COVER_ORIGIN}/cdn-cgi/image/${options}${u.pathname}`;
  } catch {
    return src;
  }
}

/** A single sized cover URL (used for the `src` fallback). */
export function coverSrc(src: string, width = 400): string {
  return transform(src, `width=${width},format=auto,quality=82,fit=cover`);
}

/** A responsive srcset string across COVER_WIDTHS. */
export function coverSrcSet(src: string): string {
  if (!TRANSFORM) return "";
  return COVER_WIDTHS.map((w) => `${coverSrc(src, w)} ${w}w`).join(", ");
}

/** A tiny, heavily blurred variant used as the LQIP background. */
export function coverPlaceholder(src: string): string {
  if (!TRANSFORM) return "";
  return transform(src, "width=24,quality=30,blur=40,format=auto,fit=cover");
}
