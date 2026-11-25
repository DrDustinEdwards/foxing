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

export const signInAgainIfStale = (error: unknown) => signInAgain(error, signInHref);

export async function signOutToHome(): Promise<void> {
  await authClient.signOut();
  window.location.assign("/");
}
