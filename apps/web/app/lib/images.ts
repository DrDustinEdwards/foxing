// Every picture a page shows, through site-runtime's defineImages: covers from COVERS at /media/covers/<key>, Journal pictures from MEDIA at /media/journal/<key> (workers/app.ts).
import { defineImages } from "@dustinedwards/site-runtime/image";
import { COVER_ORIGIN } from "./origins";

export const COVER_SIZE = { width: 484, height: 726 };

export const images = defineImages({
  uses: {
    coverThumb: { layout: "constrained", width: 80 },
    cover: { layout: "constrained", width: 240 },
    journal: { layout: "constrained", width: 768 },
  },
  // 260 is the detail cover's width, so a 1x screen is not sent the 480.
  breakpoints: [260, 480],
  shareImages: true,
});

/** A cover's attributes for one use; one on covers.foxing.app is asked for same origin through the size route. */
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
