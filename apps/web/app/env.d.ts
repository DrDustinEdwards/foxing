// Secrets are set via `wrangler secret put`; they are not in wrangler.jsonc, so
// `wrangler types` does not include them. Augment the generated global Env.
interface Env {
  BETTER_AUTH_SECRET: string;
  TURNSTILE_SECRET_KEY?: string;
  // Google OAuth (set as Worker secrets). Required for the "Continue with Google" flow.
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  // Not yet set (Phase 4a precheck, 2026-07-10): companion routes fall back to a
  // caller that errors cleanly until `wrangler secret put ANTHROPIC_API_KEY` runs.
  ANTHROPIC_API_KEY?: string;
  // Not yet set (Phase 4b gate): billing routes use the not-configured stub (503) until
  // all four are set as Worker secrets.
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_MONTHLY?: string;
  STRIPE_PRICE_ANNUAL?: string;
  // Carrel's site API key (app/lib/carrel/site-api.server.ts). Unset or under 32 characters,
  // /api/carrel/v1 refuses every request with 503 not-configured.
  CARREL_SITE_KEY?: string;
  // Operator bearer for /api/v1/admin/* (the admin MCP Worker). Unset: every bearer
  // request to the admin API is refused.
  ADMIN_OPERATOR_TOKEN?: string;
}

// The React Router vite plugin supplies this virtual module at build time.
declare module "virtual:react-router/server-build";
