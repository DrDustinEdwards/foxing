// Transactional email via the Cloudflare Email Service send_email binding (EMAIL).
// No API key: the binding sends from the onboarded foxing.app domain.
export async function sendVerificationEmail(env: Env, to: string, url: string): Promise<void> {
  try {
    await env.EMAIL.send({
      to,
      from: { email: env.EMAIL_FROM, name: "Foxing" },
      subject: "Confirm your email for Foxing",
      text: `Welcome to Foxing. Confirm your email address:\n\n${url}\n\nIf you did not create an account, ignore this message.`,
      html: [
        "<p>Welcome to Foxing.</p>",
        `<p><a href="${url}">Confirm your email address</a></p>`,
        "<p>If you did not create an account, ignore this message.</p>",
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
