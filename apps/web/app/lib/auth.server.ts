// Better Auth instance, built per-request from env (D1 is request-scoped).
// Email/password with verification via the Email Sending binding; Turnstile is
// wired but only enforced when TURNSTILE_ENABLED=true and a secret is set.
import { createDb, schema } from "@foxing/core";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { captcha } from "better-auth/plugins";
import { sendPasswordResetEmail, sendVerificationEmail } from "./email.server";

export function getAuth(env: Env) {
  const db = createDb(env.DB);

  const plugins = [];
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

export type Auth = ReturnType<typeof getAuth>;
