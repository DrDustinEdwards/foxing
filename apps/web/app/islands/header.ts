import { enhance as enhanceHeader } from "capsomer/behavior/site-header";
import { enhance as enhanceTheme } from "capsomer/behavior/theme-switch";

import { startSearchPalette } from "../lib/search-palette";
import { THEME_PREF_KEY } from "../lib/theme";

// The site header on a page that does not hydrate: the server drew it with Capsomer's React SiteHeader (parts marked data-cap-ready), and Capsomer's behavior modules wire the same markup here as one island.
export default function start(): void {
  // The behavior module reads the memory key from here, under the key root.tsx's no-flash script reads.
  for (const button of document.querySelectorAll<HTMLElement>(
    "[data-cap='theme-switch'][data-variant='button']",
  )) {
    delete button.dataset.capReady;
    button.dataset.capPref = THEME_PREF_KEY;
  }
  enhanceTheme();
  for (const header of document.querySelectorAll<HTMLElement>("[data-cap='site-header']")) {
    delete header.dataset.capReady;
  }
  enhanceHeader();
  startSearchPalette();
}
