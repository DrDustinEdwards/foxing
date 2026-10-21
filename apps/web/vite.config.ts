import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Plugin order matters: cloudflare (runs server code in workerd), then tailwind,
// then reactRouter, then tsconfigPaths.
export default defineConfig({
  // A per-build id namespaces the edge cache so a deploy never serves stale HTML from
  // the Cache API (which persists across deployments). Old entries expire via TTL.
  define: { __CACHE_VERSION__: JSON.stringify(String(Date.now())) },
  // The Worker bundle: Vite, not wrangler, builds it, so wrangler's "minify" does not apply here.
  // Source maps go up with the deploy (upload_source_maps) and are never served.
  environments: { ssr: { build: { minify: true, sourcemap: true } } },
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
  ],
});
