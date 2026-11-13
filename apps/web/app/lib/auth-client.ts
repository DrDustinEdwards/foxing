// Browser auth client: the family sign-in's plugins (site-runtime ./sign-in-client, the magic
// link and passkeys). baseURL defaults to the current origin.
import { signInClientPlugins } from "@dustinedwards/site-runtime/sign-in-client";
import { createAuthClient } from "better-auth/react";
import { signInHref } from "./sign-in-path";

export const authClient = createAuthClient({
  plugins: signInClientPlugins(),
});

export const { signIn } = authClient;

/**
 * Adding a passkey and disconnecting Google or Apple need a sign-in from the last 10 minutes
 * (site-runtime ./sign-in, FRESH_SECONDS). On Better Auth's SESSION_NOT_FRESH the reader signs in
 * again and comes back to this page. True when it was that error and the page is on its way.
 */
export function signInAgainIfStale(error: unknown): boolean {
  if ((error as { code?: string } | null)?.code !== "SESSION_NOT_FRESH") return false;
  window.location.assign(signInHref(location.pathname + location.search));
  return true;
}

/** Ends the session and loads the marketing page in full, so the root loader re-runs anonymous. */
export async function signOutToHome(): Promise<void> {
  await authClient.signOut();
  window.location.assign("/");
}
