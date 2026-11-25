// Transactional email via the Cloudflare Email Service send_email binding (EMAIL), rendered by Capsomer's email templates (which escape every value and refuse a non-https link).

import { EmailNotSent, sendEmail } from "@dustinedwards/site-runtime/email";
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

/** Sends one mail; a link or code in `secrets` and the recipient are cut out of a logged error, never the body. */
async function send(env: Env, to: string, mail: Rendered, secrets: string[] = []): Promise<void> {
  const outcome = await sendEmail(
    env.EMAIL,
    { to, from: { email: env.EMAIL_FROM, name: "Foxing" }, ...mail },
    { secrets },
  );
  if (!outcome.sent) throw new EmailNotSent(outcome.code);
}

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

export function sendSignInCodeEmail(env: Env, to: string, code: string): Promise<void> {
  return send(env, to, renderEmail(signInCode, { brand, to, code }), [code]);
}

// The email change sends two mails: the current address approves, then the new one confirms, each via /email/confirm.
// Better Auth's links are stateless JWTs good for an hour, which the mail says.
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

export function sendSecurityNoticeEmail(env: Env, to: string, detail: NoticeDetail): Promise<void> {
  const url = new URL("/settings", env.BETTER_AUTH_URL).href;
  return send(env, to, renderEmail(securityNotice, { brand, to, ...detail, url }));
}
