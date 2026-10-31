import { enhance as enhanceHeader } from "capsomer/behavior/site-header";
import { enhance as enhanceTheme } from "capsomer/behavior/theme-switch";

import { startSearchPalette } from "../lib/search-palette";
import { THEME_PREF_KEY } from "../lib/theme";

// An island (devkit ./islands): the site header (components/page-shell.tsx) on a page that does not hydrate
// (root.tsx). The server drew it with Capsomer's React SiteHeader, which marks its parts data-cap-ready because React
// wires them; here Capsomer's behavior modules wire the same markup instead: the Books and Celebrity Picks panels, the
// phone's menu sheet, each icon's tip, the theme button and the search palette. One island, so the dialog, tooltip
// and shortcut code they share loads once.
export default function start(): void {
  // React's ThemeButton keeps its memory's key in a prop; the behavior module reads it from here, under the key
  // root.tsx's no-flash script reads.
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
