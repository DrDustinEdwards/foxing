// Browser auth client: the family sign-in's plugins (site-runtime ./sign-in-client, the magic
// link and passkeys). baseURL defaults to the current origin.
import { signInClientPlugins } from "@dustinedwards/site-runtime/sign-in-client";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: signInClientPlugins(),
});

export const { signIn } = authClient;

/** Only a path on this site, never another origin (`//host` or `/\host`); else /me. */
export function safeNextPath(next: string | null): string {
  return next?.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/me";
}

/**
 * Adding a passkey and disconnecting Google or Apple need a sign-in from the last 10 minutes
 * (site-runtime ./sign-in, FRESH_SECONDS). On Better Auth's SESSION_NOT_FRESH the reader signs in
 * again and comes back to this page. True when it was that error and the page is on its way.
 */
export function signInAgainIfStale(error: unknown): boolean {
  if ((error as { code?: string } | null)?.code !== "SESSION_NOT_FRESH") return false;
  window.location.assign(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
  return true;
}
