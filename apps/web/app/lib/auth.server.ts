// Better Auth with the family's one sign-in (site-runtime ./sign-in). `appCode` opens the six-digit code request the
// phone uses (a link would open in the phone's browser), held to three a minute; the Expo plugin hands a Google or
// Apple sign-in back through foxing://.
import { expo } from "@better-auth/expo";
import { AsyncLocalStorage } from "node:async_hooks";
import { type ClubSuccessors, createDb, eraseAccountData, schema } from "@foxing/core";
import {
  SessionNotFresh,
  emailConfirmURL,
  requireFreshSession,
  sessionLookup,
  signInOptions,
} from "@dustinedwards/site-runtime/sign-in";
// Minimal build: the Drizzle adapter means Kysely and the schema-migration code never run here.
import { betterAuth } from "better-auth/minimal";
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

const leaving = new AsyncLocalStorage<ClubSuccessors>();

const APP_ORIGIN = "foxing://";

async function buildAuth(env: Env) {
  const db = createDb(env.DB);
  // A magic link proves control of the address, so the created user is email-verified.
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
    emailLimiter: env.RATE_LIMITER,
    eventsDb: env.DB,
    sessionDetails: true,
    sendSecurityNotice: async (_kind, { user, detail }) => {
      await sendSecurityNoticeEmail(env, user.email, detail);
    },
  });

  return betterAuth({
    ...signIn,
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [...signIn.trustedOrigins, SITE_ORIGIN, PREVIEW_ORIGIN, APP_ORIGIN],
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema,
      // D1 has limited transaction support; the adapter must not wrap in txns.
      transaction: false,
    }),
    plugins: [...signIn.plugins, expo()],
    // Only the /api/v1 route deletes an account, and the verification mail is only the email change's second step.
    disabledPaths: [
      ...signIn.disabledPaths,
      "/delete-user",
      "/delete-user/callback",
      "/send-verification-email",
    ],
    // The instance outlives a request, so waitUntil comes from cloudflare:workers; the answer does not wait for a notice's mail.
    advanced: { ...signIn.advanced, backgroundTasks: { handler: waitUntil } },
    // Better Auth's link acts on a GET, so a mail scanner could confirm it; the mail carries /email/confirm instead, where only the button's POST does.
    emailVerification: {
      sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) => {
        await sendVerificationEmail(env, user.email, emailConfirmURL(url));
      },
    },
    user: {
      // Changing the email takes two links (current address approves, then the new one confirms), so a stolen session alone cannot move the account.
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
      // Deleting is Better Auth's /delete-user, called only from DELETE /api/v1/account after a sign-in within 10 minutes; beforeDelete erases Foxing's data and hands over clubs first.
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

// Built once per isolate and the promise kept: Apple's client secret is signed with WebCrypto on each build.
const cache = new WeakMap<Env, Promise<Auth>>();

export function getAuth(env: Env): Promise<Auth> {
  let auth = cache.get(env);
  if (!auth) {
    auth = buildAuth(env);
    cache.set(env, auth);
    auth.catch(() => cache.delete(env)); // a failed build must not stick for the isolate's life
  }
  return auth;
}

/** The signed-in user behind a request, from the session cookie; null when none. */
export async function sessionUserFromRequest(
  req: Request,
  env: Env,
): Promise<{ id: string; email: string } | null> {
  const session = await (await getAuth(env)).api.getSession(sessionLookup(req));
  if (!session?.user) return null;
  return { id: session.user.id, email: session.user.email };
}

/** DELETE /api/v1/account's deletion, with `successors` handed to beforeDelete; "not_fresh" (nothing deleted) when the last sign-in is over 10 minutes old. */
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

/** Whether the session was made in the last 10 minutes, for the account export. */
export async function isFreshSession(req: Request, env: Env): Promise<boolean> {
  try {
    return (await requireFreshSession(await getAuth(env), req)) !== null;
  } catch (err) {
    if (err instanceof SessionNotFresh) return false;
    throw err;
  }
}
