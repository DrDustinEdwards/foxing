// Secrets are set via `wrangler secret put`; they are not in wrangler.jsonc, so
// `wrangler types` does not include them. Augment the generated global Env.
interface Env {
  BETTER_AUTH_SECRET: string;
  // Turnstile on the email link (site-runtime ./sign-in): on only when both are set.
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  // Google and Apple sign-in (site-runtime ./sign-in). Each button shows only when its
  // settings are all set. APPLE_CLIENT_ID is the Services ID; APPLE_PRIVATE_KEY the .p8 text.
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  APPLE_CLIENT_ID?: string;
  APPLE_TEAM_ID?: string;
  APPLE_KEY_ID?: string;
  APPLE_PRIVATE_KEY?: string;
  // Not yet set (Phase 4a precheck, 2026-07-10): companion routes fall back to a
  // caller that errors cleanly until `wrangler secret put ANTHROPIC_API_KEY` runs.
  ANTHROPIC_API_KEY?: string;
  // AI Gateway in front of the Anthropic calls (site-runtime's anthropicRoute): the
  // gateway's .../anthropic endpoint and its authentication token. Unset: Anthropic directly.
  AI_GATEWAY_BASE_URL?: string;
  AI_GATEWAY_TOKEN?: string;
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
  // Who is an admin: comma-separated emails, compared lower case (core isAdminAccount, through
  // site-runtime's adminEmails), checked in code as well as by Access. A secret. Unset:
  // profiles.is_admin decides, with an admin_list_unset warning in the log.
  ADMIN_EMAILS?: string;
  // Cloudflare Access in front of the admin pages and API (site-runtime ./access accessAdmin): the
  // team domain (https://<team>.cloudflareaccess.com) and the Access application's AUD tag.
  // Either unset: no browser reaches them (fails closed).
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  // "1" in .dev.vars only: lets localhost into the admin pages, since no Access sits in
  // front of `pnpm dev:web`. Ignored on any other host.
  ACCESS_DEV_BYPASS?: string;
}

// The React Router vite plugin supplies this virtual module at build time.
declare module "virtual:react-router/server-build";
