// Better Auth with the family's one sign-in (site-runtime ./sign-in): a passkey first, an
// emailed link and code before one exists (Turnstile on it once its keys are set), Google and
// Apple, no passwords, no OAuth tokens stored. Accounts are joined only by a signed-in person.
// The app's own way in: `appCode` opens the six-digit code request the phone uses (a link opens
// in the phone's browser, not the app), held to three a minute; and the Expo plugin hands a
// Google or Apple sign-in back to the app through foxing://.
import { expo } from "@better-auth/expo";
import { createDb, schema } from "@foxing/core";
import { signInOptions } from "@dustinedwards/site-runtime/sign-in";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { sendMagicLinkEmail, sendSignInCodeEmail, sendVerificationEmail } from "./email.server";
import { PREVIEW_ORIGIN, SITE_ORIGIN } from "./origins";

/** The app's scheme (apps/mobile app.json), where a sign-in started in the app returns. */
const APP_ORIGIN = "foxing://";

async function buildAuth(env: Env) {
  const db = createDb(env.DB);
  // A magic link proves control of the address, so the created user is email-verified; a new
  // user (no profile row yet) lands on /onboarding, an existing one on /me.
  const signIn = await signInOptions(env, {
    siteName: "Foxing",
    social: true,
    sendMagicLink: async ({ email, url, token, code }) => {
      await sendMagicLinkEmail(env, email, { url, token, code });
    },
    appCode: true,
    sendSignInCode: async ({ email, code }) => {
      await sendSignInCodeEmail(env, email, code);
    },
    // Five sign-in mails an hour and ten typed codes a day per address.
    emailLimiter: env.RATE_LIMITER,
  });

  return betterAuth({
    ...signIn,
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    // The live domain, the workers.dev preview and the app are all trusted; baseURL covers one.
    trustedOrigins: [...signIn.trustedOrigins, SITE_ORIGIN, PREVIEW_ORIGIN, APP_ORIGIN],
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema,
      // D1 has limited transaction support; the adapter must not wrap in txns.
      transaction: false,
    }),
    plugins: [...signIn.plugins, expo()],
    // Only the change-email flow sends this now: the new address confirms itself.
    emailVerification: {
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
  });
}

type Auth = Awaited<ReturnType<typeof buildAuth>>;

// Built once per isolate (the Worker env is stable within one) and the promise kept: Apple's
// client secret is signed with WebCrypto on each build.
const cache = new WeakMap<Env, Promise<Auth>>();

export function getAuth(env: Env): Promise<Auth> {
  let auth = cache.get(env);
  if (!auth) {
    auth = buildAuth(env);
    cache.set(env, auth);
  }
  return auth;
}

/**
 * The signed-in user behind an /api/v1 request, from the Better Auth session cookie; null when
 * there is none. The Worker's createApi resolveSession, and the Carrel key isolation tests.
 */
export async function sessionUserFromRequest(
  req: Request,
  env: Env,
): Promise<{ id: string; email: string } | null> {
  const session = await (await getAuth(env)).api.getSession({ headers: req.headers });
  if (!session?.user) return null;
  return { id: session.user.id, email: session.user.email };
}
