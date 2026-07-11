// Secrets are set via `wrangler secret put`; they are not in wrangler.jsonc, so
// `wrangler types` does not include them. Augment the generated global Env.
interface Env {
  BETTER_AUTH_SECRET: string;
  TURNSTILE_SECRET_KEY?: string;
  // Not yet set (Phase 4a precheck, 2026-07-10): companion routes fall back to a
  // caller that errors cleanly until `wrangler secret put ANTHROPIC_API_KEY` runs.
  ANTHROPIC_API_KEY?: string;
}

// The React Router vite plugin supplies this virtual module at build time.
declare module "virtual:react-router/server-build";
