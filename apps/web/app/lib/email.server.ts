// Transactional email via the Cloudflare Email Service send_email binding (EMAIL).
// No API key: the binding sends from the onboarded foxing.app domain.

import { escapeHtml } from "@dustinedwards/site-runtime/html";
import { SIGN_IN_EXPIRES_IN_WORDS } from "@dustinedwards/site-runtime/sign-in";

type Mail = { subject: string; text: string; html: string };

/** Sends one mail. A link or code in it signs in, so a send error is logged with each of
 *  `secrets` (and the recipient) cut out of its message, never the body. */
async function send(env: Env, to: string, mail: Mail, secrets: string[] = []): Promise<void> {
  try {
    await env.EMAIL.send({ to, from: { email: env.EMAIL_FROM, name: "Foxing" }, ...mail });
  } catch (err) {
    const e = err as { code?: string; message?: string };
    let message = e.message ?? String(err);
    for (const secret of [...secrets, to])
      if (secret) message = message.split(secret).join("[cut]");
    console.error(`EMAIL.send failed: code=${e.code ?? "unknown"} message=${message}`);
    throw err;
  }
}

/** One email carrying one link. The link is escaped in the HTML part: Better Auth builds it with
 *  the caller's callbackURL in the query, and a raw "&" or quote must not end the attribute. */
function sendLinkEmail(
  env: Env,
  to: string,
  mail: { subject: string; intro: string; linkText: string; url: string; outro: string },
): Promise<void> {
  return send(
    env,
    to,
    {
      subject: mail.subject,
      text: `${mail.intro}\n\n${mail.url}\n\n${mail.outro}`,
      html: [
        `<p>${escapeHtml(mail.intro)}</p>`,
        `<p><a href="${escapeHtml(mail.url)}">${escapeHtml(mail.linkText)}</a></p>`,
        `<p>${escapeHtml(mail.outro)}</p>`,
      ].join(""),
    },
    [mail.url],
  );
}

const CODE_STYLE = "font-size:24px;letter-spacing:4px";

/** The sign-in mail (site-runtime ./sign-in): the link signs in the browser that opens it, the
 *  code is typed into the tab that asked, when the link opens somewhere else (a phone's mail app). */
export function sendMagicLinkEmail(
  env: Env,
  to: string,
  { url, token, code }: { url: string; token: string; code: string },
): Promise<void> {
  const outro = `The link and the code each work once, for ${SIGN_IN_EXPIRES_IN_WORDS}. If you did not request them, ignore this message.`;
  return send(
    env,
    to,
    {
      subject: "Your Foxing sign-in link",
      text: `Sign in to Foxing:\n\n${url}\n\nOr type this code on the page that asked: ${code}\n\n${outro}`,
      html: [
        "<p>Sign in to Foxing:</p>",
        `<p><a href="${escapeHtml(url)}">Sign in</a></p>`,
        "<p>Or type this code on the page that asked:</p>",
        `<p style="${CODE_STYLE}"><strong>${escapeHtml(code)}</strong></p>`,
        `<p>${escapeHtml(outro)}</p>`,
      ].join(""),
    },
    [url, token, code],
  );
}

/** The app's sign-in code (site-runtime ./sign-in appCode): the phone can't take a link that
 *  opens in the browser, so it asks for the code alone. */
export function sendSignInCodeEmail(env: Env, to: string, code: string): Promise<void> {
  const outro = `It works once, for ${SIGN_IN_EXPIRES_IN_WORDS}. If you did not request it, ignore this message.`;
  return send(
    env,
    to,
    {
      subject: `${code} is your Foxing sign-in code`,
      text: `Your Foxing sign-in code is ${code}\n\n${outro}`,
      html: [
        "<p>Your Foxing sign-in code is</p>",
        `<p style="${CODE_STYLE}"><strong>${escapeHtml(code)}</strong></p>`,
        `<p>${escapeHtml(outro)}</p>`,
      ].join(""),
    },
    [code],
  );
}

export function sendVerificationEmail(env: Env, to: string, url: string): Promise<void> {
  return sendLinkEmail(env, to, {
    subject: "Confirm your email for Foxing",
    intro: "Welcome to Foxing. Confirm your email address:",
    linkText: "Confirm your email address",
    url,
    outro: "If you did not create an account, ignore this message.",
  });
}
