// Better Auth instance, built per-request from env (D1 is request-scoped).
// Email/password with verification via the Email Sending binding; Turnstile is
// wired but only enforced when TURNSTILE_ENABLED=true and a secret is set.
import { createDb, schema } from "@foxing/core";
import { type BetterAuthPlugin, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { captcha, magicLink } from "better-auth/plugins";
import { sendMagicLinkEmail, sendPasswordResetEmail, sendVerificationEmail } from "./email.server";
import { PREVIEW_ORIGIN, SITE_ORIGIN } from "./origins";

const NO_OAUTH_TOKENS = {
  accessToken: null,
  refreshToken: null,
  idToken: null,
  accessTokenExpiresAt: null,
  refreshTokenExpiresAt: null,
};

export function getAuth(env: Env) {
  const db = createDb(env.DB);

  // Passwordless sign-in link. A magic link inherently proves control of the address,
  // so the created user is email-verified; a new user (no profile row yet) lands on
  // /onboarding, an existing one on /me. Same send path as verification/reset.
  const plugins: BetterAuthPlugin[] = [
    magicLink({
      expiresIn: 60 * 10,
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail(env, email, url);
      },
    }),
  ];
  if (String(env.TURNSTILE_ENABLED) === "true" && env.TURNSTILE_SECRET_KEY) {
    plugins.push(
      captcha({
        provider: "cloudflare-turnstile",
        secretKey: env.TURNSTILE_SECRET_KEY,
      }),
    );
  }

  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    // Both the live domain and the workers.dev preview must be accepted so auth works
    // on each. baseURL covers one; trustedOrigins lists both explicitly.
    trustedOrigins: [SITE_ORIGIN, PREVIEW_ORIGIN],
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema,
      // D1 has limited transaction support; the adapter must not wrap in txns.
      transaction: false,
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => {
        await sendPasswordResetEmail(env, user.email, url);
      },
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },
    account: {
      // A Google sign-in whose (Google-verified) email matches an existing verified
      // account links into that row instead of duplicating it. trustedProviders lets
      // Google's email_verified claim stand as ownership proof for the link.
      accountLinking: {
        enabled: true,
        trustedProviders: ["google"],
      },
    },
    // Google is sign-in only, and nothing reads its tokens, so none are stored (FX-3). Every
    // account write Better Auth makes on a Google sign-in (createOAuthUser, linkAccount,
    // updateAccount) runs these hooks; migration 0005 cleared the rows from before.
    databaseHooks: {
      account: {
        create: { before: async () => ({ data: NO_OAUTH_TOKENS }) },
        update: { before: async () => ({ data: NO_OAUTH_TOKENS }) },
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) => {
        await sendVerificationEmail(env, user.email, url);
      },
    },
    user: {
      // Email change requires confirmation. The link goes to the current address so
      // the account owner approves the switch; the new address takes effect on click.
      changeEmail: {
        enabled: true,
        sendChangeEmailVerification: async ({
          user,
          url,
        }: {
          user: { email: string };
          newEmail: string;
          url: string;
        }) => {
          await sendVerificationEmail(env, user.email, url);
        },
      },
    },
    plugins,
  });
}

/**
 * The signed-in user behind an /api/v1 request, from the Better Auth session cookie; null when
 * there is none. The Worker's createApi resolveSession, and the Carrel key isolation tests.
 */
export async function sessionUserFromRequest(
  req: Request,
  env: Env,
): Promise<{ id: string; email: string } | null> {
  const session = await getAuth(env).api.getSession({ headers: req.headers });
  if (!session?.user) return null;
  return { id: session.user.id, email: session.user.email };
}
