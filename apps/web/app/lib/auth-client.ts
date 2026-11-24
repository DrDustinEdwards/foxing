// Browser auth client: the family sign-in's plugins (site-runtime ./sign-in-client, the magic
// link and passkeys). baseURL defaults to the current origin.
import {
  signInAgainIfStale as signInAgain,
  signInClientPlugins,
} from "@dustinedwards/site-runtime/sign-in-client";
import { createAuthClient } from "better-auth/react";
import { signInHref } from "./sign-in-path";

export const authClient = createAuthClient({
  plugins: signInClientPlugins(),
});

export const { signIn } = authClient;

/** On a stale session (SESSION_NOT_FRESH) sends the reader to sign in again and back here. */
export const signInAgainIfStale = (error: unknown) => signInAgain(error, signInHref);

/** Ends the session and loads the marketing page in full, so the root loader re-runs anonymous. */
export async function signOutToHome(): Promise<void> {
  await authClient.signOut();
  window.location.assign("/");
}
