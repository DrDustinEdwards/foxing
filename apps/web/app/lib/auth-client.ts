// Browser auth client: the family sign-in's plugins (site-runtime ./sign-in-client, the magic
// link and passkeys). baseURL defaults to the current origin. Capsomer's sign-in screen and
// account settings make their browser calls (passkeys, Google and Apple, other devices) on it.
import { signInClientPlugins } from "@dustinedwards/site-runtime/sign-in-client";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: signInClientPlugins(),
});
