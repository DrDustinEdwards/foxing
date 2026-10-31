// Transactional email via the Cloudflare Email Service send_email binding (EMAIL).
// No API key: the binding sends from the onboarded foxing.app domain. Every mail is
// rendered by Capsomer's email templates (capsomer/email), which escape every value
// and refuse a link that is not https.

import { logEvent } from "@dustinedwards/site-runtime/log";
import { type NoticeDetail, SIGN_IN_EXPIRES_IN_WORDS } from "@dustinedwards/site-runtime/sign-in";
import {
  type Brand,
  magicLink,
  type Rendered,
  renderEmail,
  securityNotice,
  type Template,
} from "capsomer/email";

const brand: Brand = { name: "Foxing", family: "fox" };

/** Sends one mail. A link or code in it signs in, so a send error is logged with each of
 *  `secrets` (and the recipient) cut out of its message, never the body. */
async function send(env: Env, to: string, mail: Rendered, secrets: string[] = []): Promise<void> {
  try {
    await env.EMAIL.send({ to, from: { email: env.EMAIL_FROM, name: "Foxing" }, ...mail });
  } catch (err) {
    const e = err as { code?: string; message?: string };
    let message = e.message ?? String(err);
    for (const secret of [...secrets, to])
      if (secret) message = message.split(secret).join("[cut]");
    logEvent("email_send_failed", { code: e.code ?? "unknown", message }, { level: "error" });
    throw err;
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

// Not Capsomer's verification template, which says its link works once: Better Auth's is a
// stateless JWT good for an hour (better-auth 1.7.12 dist/api/routes/email-verification.mjs).
const confirmEmail: Template<{ url: string }> = {
  name: "confirm-email",
  subject: () => "Confirm your email for Foxing",
  blocks: (d) => [
    { type: "heading", text: "Confirm your email address" },
    { type: "paragraph", text: "Welcome to Foxing. Use the button to confirm the address." },
    { type: "button", label: "Confirm your email address", url: d.url },
    { type: "fine", text: "If you did not create an account, ignore this message." },
  ],
};

export function sendVerificationEmail(env: Env, to: string, url: string): Promise<void> {
  return send(env, to, renderEmail(confirmEmail, { brand, to, url }), [url]);
}

/** A change to how the reader signs in (site-runtime ./sign-in `sendSecurityNotice`) on
 *  Capsomer's security-notice template, its button back to /settings. It holds no sign-in link. */
export function sendSecurityNoticeEmail(env: Env, to: string, detail: NoticeDetail): Promise<void> {
  const url = new URL("/settings", env.BETTER_AUTH_URL).href;
  return send(env, to, renderEmail(securityNotice, { brand, to, ...detail, url }));
}
