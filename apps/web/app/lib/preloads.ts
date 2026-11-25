import fraunces from "@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2?url";
import sourceSerif from "@fontsource-variable/source-serif-4/files/source-serif-4-latin-opsz-normal.woff2?url";
import dmSans from "@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2?url";
import type { Preload } from "@dustinedwards/site-runtime/preload";

/** The faces every page paints first (the files root.tsx loads); they are font-display: optional, so a face that misses its first ~100 ms stays in the fallback for that visit, and the preload gets it there in time. */
export const FONT_PRELOADS: Preload[] = [
  { href: fraunces, as: "font", type: "font/woff2" },
  { href: sourceSerif, as: "font", type: "font/woff2" },
  { href: dmSans, as: "font", type: "font/woff2" },
];
