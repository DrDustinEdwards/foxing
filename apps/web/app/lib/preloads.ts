import fraunces from "@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2?url";
import sourceSerif from "@fontsource-variable/source-serif-4/files/source-serif-4-latin-opsz-normal.woff2?url";
import type { Preload } from "@dustinedwards/site-runtime/preload";

/** The faces every page paints first: Fraunces headings and Source Serif body text, the same files root.tsx loads. */
export const FONT_PRELOADS: Preload[] = [
  { href: fraunces, as: "font", type: "font/woff2" },
  { href: sourceSerif, as: "font", type: "font/woff2" },
];
