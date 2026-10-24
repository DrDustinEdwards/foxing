// Browser auth client: the family sign-in's plugins (site-runtime ./sign-in-client, the magic
// link and passkeys). baseURL defaults to the current origin.
import { signInClientPlugins } from "@dustinedwards/site-runtime/sign-in-client";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: signInClientPlugins(),
});

export const { signIn } = authClient;
