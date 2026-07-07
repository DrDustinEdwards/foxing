import type { Config } from "@react-router/dev/config";

// SSR on Workers via @cloudflare/vite-plugin (edge SSR + cache is the Phase 3
// Core Web Vitals lever).
export default {
  ssr: true,
} satisfies Config;
