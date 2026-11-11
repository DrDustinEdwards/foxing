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
  EMAIL_CONFIRM_PATH,
  SessionNotFresh,
  requireFreshSession,
  sessionLookup,
  signInOptions,
} from "@dustinedwards/site-runtime/sign-in";
import { accountOptions } from "@dustinedwards/site-runtime/sign-in-form";
import { betterAuth } from "better-auth";
import { waitUntil } from "cloudflare:workers";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
  sendEmailChangeEmail,
  sendMagicLinkEmail,
  sendSecurityNoticeEmail,
  sendSignInCodeEmail,
} from "./email.server";
import { PREVIEW_ORIGIN, SITE_ORIGIN } from "./origins";

/** The club hand-over of the app's deletion running now (DELETE /api/v1/account, deleteUserAccount),
 *  for Better Auth's beforeDelete. */
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

  // The email change (two links, each opening /email/confirm, whose button does the step) and the
  // deletion, the same on every site (site-runtime ./sign-in-form accountOptions). Better Auth's
  // /delete-user is off: the settings page's action (accountFormAction, which hands the clubs over
  // and erases first) and the app's DELETE /api/v1/account (deleteUserAccount) call deleteUser after
  // their fresh sign-in check. beforeDelete erases Foxing's own data (core eraseAccountData, with the
  // app's hand-over); on the settings page's deletion that is done already, so it finds nothing
  // left. Better Auth then removes the sessions, the Google and Apple links and the user (passkeys
  // go with it).
  const account = accountOptions({
    confirmPath: EMAIL_CONFIRM_PATH,
    sendEmailChange: (mail) => sendEmailChangeEmail(env, mail),
    beforeDelete: async (user) => {
      await eraseAccountData(db, user.id, leaving.getStore() ?? {});
    },
  });

  return betterAuth({
    ...signIn,
    ...account,
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
    disabledPaths: [...signIn.disabledPaths, ...account.disabledPaths],
    // The instance outlives a request, so the request's waitUntil comes from cloudflare:workers:
    // the answer does not wait for a security notice's mail.
    advanced: { ...signIn.advanced, backgroundTasks: { handler: waitUntil } },
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

/** What a server-side getSession reads: site-runtime sessionLookup (always `asResponse: false`; the request too on a GET). */
export { sessionLookup };

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
