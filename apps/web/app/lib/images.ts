// Every picture a page shows, through site-runtime's defineImages: covers from the COVERS bucket at
// /media/covers/<key> and Journal pictures from MEDIA at /media/journal/<key> (workers/app.ts), each
// size from one closed set, as AVIF and WebP.
import { defineImages } from "@dustinedwards/site-runtime/image";
import { COVER_ORIGIN } from "./origins";

/** Every cover is drawn at this size (2:3), so a page sizes one without reading it. */
export const COVER_SIZE = { width: 484, height: 726 };

export const images = defineImages({
  uses: {
    // Covers shown up to about 80px (diary, picks), and everything larger up to the 260px detail cover.
    coverThumb: { layout: "constrained", width: 80 },
    cover: { layout: "constrained", width: 240 },
    // A Journal post's cover, the column's width.
    journal: { layout: "constrained", width: 768 },
  },
  // 260: the detail cover's own width, so a 1x screen is not sent the 480 (1.8 times what it shows).
  // 480: one more size between a cover's 2x and the original, and the Journal's 1x on a phone.
  breakpoints: [260, 480],
  // The share crop and the Article image set (16:9, 4:3 and 1:1 at 1200 wide) for a Journal post's structured data.
  shareImages: true,
});

/**
 * A cover's attributes for one use (`sizes` names the layout where it differs from the use's): one on
 * covers.foxing.app is asked for same origin, through the size route; any other address as it is.
 */
export function coverAttributes(
  coverUrl: string,
  options: { use?: "cover" | "coverThumb"; sizes?: string } = {},
) {
  const stored = coverUrl.startsWith(`${COVER_ORIGIN}/`)
    ? { src: `/media/covers/${coverUrl.slice(COVER_ORIGIN.length + 1)}`, ...COVER_SIZE }
    : { src: coverUrl, width: null, height: null };
  const attrs = images.attributes(stored, options.use ?? "cover");
  return { ...attrs, sizes: options.sizes ?? attrs.sizes };
}
