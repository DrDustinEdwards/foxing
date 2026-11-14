import { cloudflare } from "@cloudflare/vite-plugin";
import { nativeBuiltins } from "@dustinedwards/devkit/vite/native-builtins";
import { siteScript } from "@dustinedwards/devkit/vite/site-script";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig, type Plugin } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Plugin order matters: cloudflare (runs server code in workerd), then reactRouter,
// then tsconfigPaths. siteScript builds /site.js and the islands it starts (app/site.ts,
// app/islands/*.ts): the only script a public page runs. A page that hydrates
// (`handle = { hydrate: true }`, or a signed-in reader; root.tsx) gets React instead.
/**
 * Fontsource's rules (root.tsx) with font-display: optional in place of swap, the family's setting (capsomer/fonts.css,
 * dustinedwards.info, germomics). The browser waits about 100 ms for a face, and a visit it misses stays in the
 * size-matched fallback (capsomer/fallback-fonts.css, app.css), so text never moves once drawn. With swap, DM Sans
 * arriving after the first paint narrowed a chart's export buttons by a pixel, enough to move one up a line at 320 px
 * (D5, 2026-11-06). app/lib/preloads.ts preloads the faces pages draw first so the first visit gets them in time.
 */
function fontDisplayOptional(): Plugin {
  return {
    name: "foxing:font-display-optional",
    enforce: "pre",
    transform(code, id) {
      if (!/[\\/]@fontsource(-variable)?[\\/][^?]+\.css$/.test(id)) return null;
      if (!code.includes("font-display: swap;"))
        this.error(`${id}: no font-display: swap to replace`);
      return { code: code.replaceAll("font-display: swap;", "font-display: optional;"), map: null };
    },
  };
}

export default defineConfig({
  // A per-build id namespaces the edge cache so a deploy never serves stale HTML from
  // the Cache API (which persists across deployments). Old entries expire via TTL.
  define: { __CACHE_VERSION__: JSON.stringify(String(Date.now())) },
  // The Worker bundle: Vite, not wrangler, builds it, so wrangler's "minify" does not apply here.
  // Source maps go up with the deploy (upload_source_maps) and are never served.
  environments: { ssr: { build: { minify: true, sourcemap: true } } },
  plugins: [
    // First: mdast-util-to-hast's structuredClone polyfill becomes the global, which Workers have.
    nativeBuiltins(),
    fontDisplayOptional(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    reactRouter(),
    tsconfigPaths(),
    siteScript({ toolbar: false }),
  ],
});
