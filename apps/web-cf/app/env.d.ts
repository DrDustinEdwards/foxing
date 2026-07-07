// Secrets are set via `wrangler secret put`; they are not in wrangler.jsonc, so
// `wrangler types` does not include them. Augment the generated global Env.
interface Env {
  BETTER_AUTH_SECRET: string;
  TURNSTILE_SECRET_KEY?: string;
}

// The React Router vite plugin supplies this virtual module at build time.
declare module "virtual:react-router/server-build";
