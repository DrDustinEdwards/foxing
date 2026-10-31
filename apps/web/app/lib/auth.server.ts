// Better Auth with the family's one sign-in (site-runtime ./sign-in): a passkey first, an
// emailed link and code before one exists (Turnstile in front of it), Google and
// Apple, no passwords, no OAuth tokens stored. Accounts are joined only by a signed-in person.
// The app's own way in: `appCode` opens the six-digit code request the phone uses (a link opens
// in the phone's browser, not the app), held to three a minute; and the Expo plugin hands a
// Google or Apple sign-in back to the app through foxing://.
import { expo } from "@better-auth/expo";
import { AsyncLocalStorage } from "node:async_hooks";
import { type ClubSuccessors, createDb, eraseAccountData, schema } from "@foxing/core";
import {
  SessionNotFresh,
  emailConfirmURL,
  requireFreshSession,
  signInOptions,
} from "@dustinedwards/site-runtime/sign-in";
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
    // Five sign-in mails an hour, and wrong codes three an hour and ten a day, per address.
    emailLimiter: env.RATE_LIMITER,
    // Each auth event is also a row in auth_events (migration 0012): Settings' security history,
    // /health's spike check, and new-device and recovery notices read it.
    eventsDb: env.DB,
    // Each session keeps its coarse place and a device id, and a read moves its last-active time
    // (migration 0014): the signed-in devices list and the new-device notice read them.
    sessionDetails: true,
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
    // approved the change. The link is good for an hour (Better Auth's default). Better Auth's own
    // link acts on a GET, so a mail scanner could confirm it; the mail carries /email/confirm
    // instead, where only the button's POST does (site-runtime emailConfirmURL).
    emailVerification: {
      sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) => {
        await sendVerificationEmail(env, user.email, emailConfirmURL(url));
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
          await sendChangeEmailConfirmation(env, user.email, newEmail, emailConfirmURL(url));
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
 * What a server-side getSession reads: on a GET the request too, so the session's place follows
 * the reader (site-runtime sessionDetails; the last-active time moves either way). Any other
 * method leaves it out: Better Auth would hold the request to /get-session's GET and POST, and
 * could read a POST's body before the action does.
 */
export function sessionLookup(request: Request): { headers: Headers; request?: Request } {
  return request.method === "GET"
    ? { headers: request.headers, request }
    : { headers: request.headers };
}

/**
 * The signed-in user behind an /api/v1 request, from the Better Auth session cookie; null when
 * there is none. The Worker's createApi resolveSession, and the Carrel key isolation tests.
 */
export async function sessionUserFromRequest(
  req: Request,
  env: Env,
): Promise<{ id: string; email: string } | null> {
  const session = await (await getAuth(env)).api.getSession(sessionLookup(req));
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

/** Whether the request's session was made in the last 10 minutes (site-runtime
 *  requireFreshSession), for the account export. */
export async function isFreshSession(req: Request, env: Env): Promise<boolean> {
  try {
    return (await requireFreshSession(await getAuth(env), req)) !== null;
  } catch (err) {
    if (err instanceof SessionNotFresh) return false;
    throw err;
  }
}
