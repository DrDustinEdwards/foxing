// Transactional email via the Cloudflare Email Service send_email binding (EMAIL).
// No API key: the binding sends from the onboarded foxing.app domain. Every mail is
// rendered by Capsomer's email templates (capsomer/email), which escape every value
// and refuse a link that is not https.

import { logEvent } from "@dustinedwards/site-runtime/log";
import { type NoticeDetail, SIGN_IN_EXPIRES_IN_WORDS } from "@dustinedwards/site-runtime/sign-in";
import {
  type Brand,
  emailChange,
  magicLink,
  type Rendered,
  renderEmail,
  securityNotice,
  type Template,
} from "capsomer/email";

const brand: Brand = { name: "Foxing", family: "fox" };

/** Sends one mail. A link or code in it signs in, so a send error is logged with each of
 *  `secrets` (and the recipient) cut out of its message, never the body, and what is thrown
 *  is a plain error that holds none of the provider's words: Better Auth logs it as it is. */
async function send(env: Env, to: string, mail: Rendered, secrets: string[] = []): Promise<void> {
  try {
    await env.EMAIL.send({ to, from: { email: env.EMAIL_FROM, name: "Foxing" }, ...mail });
  } catch (err) {
    const e = err as { code?: string; message?: string };
    let message = e.message ?? String(err);
    for (const secret of [...secrets, to])
      if (secret) message = message.split(secret).join("[cut]");
    // The binding's error codes are short names (E_SENDER_NOT_VERIFIED); anything else is cut.
    const code = /^[\w.-]{1,64}$/.test(e.code ?? "") ? (e.code as string) : "unknown";
    logEvent("email_send_failed", { code, message }, { level: "error" });
    throw new Error(`Email not sent (${code}).`);
  }
}

/** The sign-in mail (site-runtime ./sign-in) on Capsomer's magic-link template: the link signs
 *  in the browser that opens it, the code is typed into the tab that asked, when the link opens
 *  somewhere else (a phone's mail app). */
export function sendMagicLinkEmail(
  env: Env,
  to: string,
  { url, token, code }: { url: string; token: string; code: string },
): Promise<void> {
  const mail = renderEmail(magicLink, {
    brand,
    to,
    url,
    code,
    expiresIn: SIGN_IN_EXPIRES_IN_WORDS,
    copy: { subject: "Your Foxing sign-in link" },
  });
  return send(env, to, mail, [url, token, code]);
}

const signInCode: Template<{ code: string }> = {
  name: "sign-in-code",
  subject: (d) => `${d.code} is your Foxing sign-in code`,
  blocks: (d) => [
    { type: "heading", text: "Your Foxing sign-in code" },
    { type: "code", text: d.code },
    {
      type: "fine",
      text: `It works once, for ${SIGN_IN_EXPIRES_IN_WORDS}. If you did not request it, ignore this message.`,
    },
  ],
};

/** The app's sign-in code (site-runtime ./sign-in appCode): the phone can't take a link that
 *  opens in the browser, so it asks for the code alone. */
export function sendSignInCodeEmail(env: Env, to: string, code: string): Promise<void> {
  return send(env, to, renderEmail(signInCode, { brand, to, code }), [code]);
}

// The email change sends two mails, both Capsomer's emailChange template: the current address
// approves, then the new address confirms. Each link opens /email/confirm, whose button does the
// step (auth.server.ts, emailConfirmURL). Better Auth's links are stateless JWTs good for an hour
// (better-auth 1.7.12 dist/api/routes/email-verification.mjs), which the mail says.
const EMAIL_CHANGE_EXPIRES_IN = "1 hour";

export function sendChangeEmailConfirmation(
  env: Env,
  to: string,
  newEmail: string,
  url: string,
): Promise<void> {
  const mail = renderEmail(emailChange, {
    brand,
    to,
    step: "current",
    newEmail,
    url,
    expiresIn: EMAIL_CHANGE_EXPIRES_IN,
  });
  return send(env, to, mail, [url]);
}

export function sendVerificationEmail(env: Env, to: string, url: string): Promise<void> {
  const mail = renderEmail(emailChange, {
    brand,
    to,
    step: "new",
    url,
    expiresIn: EMAIL_CHANGE_EXPIRES_IN,
  });
  return send(env, to, mail, [url]);
}

/** A change to how the reader signs in (site-runtime ./sign-in `sendSecurityNotice`) on
 *  Capsomer's security-notice template, its button back to /settings. It holds no sign-in link. */
export function sendSecurityNoticeEmail(env: Env, to: string, detail: NoticeDetail): Promise<void> {
  const url = new URL("/settings", env.BETTER_AUTH_URL).href;
  return send(env, to, renderEmail(securityNotice, { brand, to, ...detail, url }));
}
