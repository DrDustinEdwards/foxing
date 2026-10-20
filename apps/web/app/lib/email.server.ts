// Transactional email via the Cloudflare Email Service send_email binding (EMAIL).
// No API key: the binding sends from the onboarded foxing.app domain.

import { escapeHtml } from "@dustinedwards/site-runtime/html";

/** One email carrying one link. The link is escaped in the HTML part: Better Auth builds it with
 *  the caller's callbackURL in the query, and a raw "&" or quote must not end the attribute. */
async function sendLinkEmail(
  env: Env,
  to: string,
  mail: { subject: string; intro: string; linkText: string; url: string; outro: string },
): Promise<void> {
  try {
    await env.EMAIL.send({
      to,
      from: { email: env.EMAIL_FROM, name: "Foxing" },
      subject: mail.subject,
      text: `${mail.intro}\n\n${mail.url}\n\n${mail.outro}`,
      html: [
        `<p>${escapeHtml(mail.intro)}</p>`,
        `<p><a href="${escapeHtml(mail.url)}">${escapeHtml(mail.linkText)}</a></p>`,
        `<p>${escapeHtml(mail.outro)}</p>`,
      ].join(""),
    });
  } catch (err) {
    const e = err as { code?: string; message?: string };
    console.error(
      `EMAIL.send failed: code=${e.code ?? "unknown"} message=${e.message ?? String(err)}`,
    );
    throw err;
  }
}

export function sendPasswordResetEmail(env: Env, to: string, url: string): Promise<void> {
  return sendLinkEmail(env, to, {
    subject: "Reset your Foxing password",
    intro: "Reset your Foxing password:",
    linkText: "Reset password",
    url,
    outro: "This link expires in 1 hour. If you did not request a reset, ignore this message.",
  });
}

export function sendMagicLinkEmail(env: Env, to: string, url: string): Promise<void> {
  return sendLinkEmail(env, to, {
    subject: "Your Foxing sign-in link",
    intro: "Sign in to Foxing:",
    linkText: "Sign in",
    url,
    outro:
      "This link expires in 10 minutes and can be used once. If you did not request it, ignore this message.",
  });
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
