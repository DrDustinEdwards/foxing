// The one script a page that does not hydrate runs, /site.js (devkit's siteScript in vite.config.ts). root.tsx loads it
// on every page whose routes do not ask to hydrate (`handle = { hydrate: true }`) for a signed-out reader, and leaves
// React's <Scripts/> out there, so React and an island never wire the same markup twice. It starts every [data-island]
// element on the page, importing that island's content-hashed module from /islands/: the header (every page) and the
// search-as-you-type field (the home page).
import { startIslands } from "@dustinedwards/devkit/islands";

// Covers (components/cover-image.tsx) fade in over their blur-up placeholder once the image has loaded, which React's
// onLoad marks on a hydrating page.
function startCovers() {
  for (const box of document.querySelectorAll<HTMLElement>(".cover-img[data-loaded='false']")) {
    const img = box.querySelector("img");
    if (!img) continue;
    const loaded = () => {
      box.dataset.loaded = "true";
    };
    if (img.complete && img.naturalWidth > 0) loaded();
    else img.addEventListener("load", loaded, { once: true });
  }
}

startCovers();
startIslands();
