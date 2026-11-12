// Secrets are set via `wrangler secret put`; they are not in wrangler.jsonc, so
// `wrangler types` does not include them. Augment the generated global Env.
// The secrets every site shares are site-runtime's SiteSecrets (./worker): MAINTENANCE, the admin list (ADMIN_EMAIL,
// CO_OWNER_EMAILS), Cloudflare Access (ACCESS_TEAM_DOMAIN, ACCESS_AUD, ACCESS_DEV_BYPASS), ADMIN_IDLE_SECRET,
// OPERATOR_TOKEN, CARREL_SITE_KEY, ANTHROPIC_API_KEY and Turnstile's two keys. Below are only Foxing's own.
type SiteSecrets = import("@dustinedwards/site-runtime/worker").SiteSecrets;

interface Env extends SiteSecrets {
  BETTER_AUTH_SECRET: string;
  // Google and Apple sign-in (site-runtime ./sign-in). Each button shows only when its
  // settings are all set. APPLE_CLIENT_ID is the Services ID; APPLE_PRIVATE_KEY the .p8 text.
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  APPLE_CLIENT_ID?: string;
  APPLE_TEAM_ID?: string;
  APPLE_KEY_ID?: string;
  APPLE_PRIVATE_KEY?: string;
  // Not yet set (Phase 4b gate): billing routes use the not-configured stub (503) until
  // all four are set as Worker secrets.
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_MONTHLY?: string;
  STRIPE_PRICE_ANNUAL?: string;
  // Operator bearer for /api/v1/admin/* (the admin MCP Worker). Unset: every bearer
  // request to the admin API is refused.
  ADMIN_OPERATOR_TOKEN?: string;
}

// The React Router vite plugin supplies this virtual module at build time.
declare module "virtual:react-router/server-build";
