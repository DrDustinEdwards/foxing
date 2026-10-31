// Better Auth with the family's one sign-in (site-runtime ./sign-in): a passkey first, an
// emailed link and code before one exists (Turnstile on it once its keys are set), Google and
// Apple, no passwords, no OAuth tokens stored. Accounts are joined only by a signed-in person.
// The app's own way in: `appCode` opens the six-digit code request the phone uses (a link opens
// in the phone's browser, not the app), held to three a minute; and the Expo plugin hands a
// Google or Apple sign-in back to the app through foxing://.
import { expo } from "@better-auth/expo";
import { AsyncLocalStorage } from "node:async_hooks";
import { type ClubSuccessors, createDb, eraseAccountData, schema } from "@foxing/core";
import { signInOptions } from "@dustinedwards/site-runtime/sign-in";
import { betterAuth } from "better-auth";
import { waitUntil } from "cloudflare:workers";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
  sendChangeEmailConfirmation,
  sendMagicLinkEmail,
  sendSecurityNoticeEmail,
  sendSignInCodeEmail,
  sendVerificationEmail,
} from "./email.server";
import { PREVIEW_ORIGIN, SITE_ORIGIN } from "./origins";

/** The club hand-over of the deletion running now, for beforeDelete (deleteUserAccount). */
const leaving = new AsyncLocalStorage<ClubSuccessors>();

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
    // A passkey, Google or Apple, the email, the sessions or the account changed: tell the reader.
    sendSecurityNotice: async (_kind, { user, detail }) => {
      await sendSecurityNoticeEmail(env, user.email, detail);
    },
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
    // Only the /api/v1 route deletes an account (its club hand-over comes in its body), and
    // the verification mail is only the email change's second step, never sent on request.
    disabledPaths: [
      ...signIn.disabledPaths,
      "/delete-user",
      "/delete-user/callback",
      "/send-verification-email",
    ],
    // The instance outlives a request, so the request's waitUntil comes from cloudflare:workers:
    // the answer does not wait for a security notice's mail.
    advanced: { ...signIn.advanced, backgroundTasks: { handler: waitUntil } },
    // Only the change-email flow sends this now, to the new address, once the current one has
    // approved the change. The link is good for an hour (Better Auth's default).
    emailVerification: {
      sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) => {
        await sendVerificationEmail(env, user.email, url);
      },
    },
    user: {
      // Changing the email takes two links (better-auth 1.7.12 update-user.mjs, changeEmail):
      // the current address approves first, then the new address confirms itself, and only
      // then does the email change. A person with only a stolen session cannot move the account
      // to an address of their own. site-runtime ./sign-in tells both addresses after.
      changeEmail: {
        enabled: true,
        sendChangeEmailConfirmation: async ({
          user,
          newEmail,
          url,
        }: {
          user: { email: string };
          newEmail: string;
          url: string;
        }) => {
          await sendChangeEmailConfirmation(env, user.email, newEmail, url);
        },
      },
      // Deleting the account is Better Auth's /delete-user, called only from DELETE
      // /api/v1/account (deleteUserAccount), with a sign-in from the last 10 minutes.
      // beforeDelete erases Foxing's own data and hands over the clubs first; Better Auth then
      // removes the sessions, the Google and Apple links and the user (passkeys go with it).
      deleteUser: {
        enabled: true,
        beforeDelete: async (user: { id: string }) => {
          await eraseAccountData(db, user.id, leaving.getStore() ?? {});
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

/**
 * DELETE /api/v1/account's deletion: Better Auth's deleteUser for the signed-in reader, with
 * `successors` handed to beforeDelete. "not_fresh" when the last sign-in is over 10 minutes old
 * (site-runtime ./sign-in FRESH_SECONDS), and nothing is deleted.
 */
export async function deleteUserAccount(
  req: Request,
  env: Env,
  successors: ClubSuccessors,
): Promise<"deleted" | "not_fresh"> {
  const auth = await getAuth(env);
  try {
    await leaving.run(successors, () => auth.api.deleteUser({ headers: req.headers, body: {} }));
    return "deleted";
  } catch (err) {
    const code = (err as { body?: { code?: string } }).body?.code;
    if (code === "SESSION_EXPIRED" || code === "SESSION_NOT_FRESH") return "not_fresh";
    throw err;
  }
}
