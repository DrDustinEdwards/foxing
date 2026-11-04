import type { Config } from "@react-router/dev/config";

// SSR on Workers via @cloudflare/vite-plugin (edge SSR + cache is the Phase 3
// Core Web Vitals lever).
export default {
  ssr: true,
  // An import map with every chunk's integrity and `integrity` on each modulepreload, which Integrity-Policy needs
  // (site-runtime's registry entry stages it Report-Only).
  subResourceIntegrity: true,
} satisfies Config;
