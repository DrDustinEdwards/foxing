// Browser auth client. baseURL defaults to the current origin.
import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [magicLinkClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
