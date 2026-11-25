// The one script a page that does not hydrate runs (/site.js): it starts every [data-island] element, so React and an island never wire the same markup twice.
import { startPage } from "@dustinedwards/site-runtime/page-client";
import { startIslands } from "@dustinedwards/devkit/islands";

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

startPage();
startCovers();
startIslands();
