import { describe, expect, it } from "vitest";
import { sendMagicLinkEmail } from "../app/lib/email.server";

describe("link emails", () => {
  it("escape the link in the HTML part and keep it raw in the text part", async () => {
    const sent: Array<{ html: string; text: string }> = [];
    const env = {
      EMAIL_FROM: "hello@example.com",
      EMAIL: { send: async (m: { html: string; text: string }) => void sent.push(m) },
    } as unknown as Env;
    const url = `https://foxing.test/api/auth/magic-link/verify?token=t&callbackURL="><script>`;
    await sendMagicLinkEmail(env, "reader@example.com", url);
    expect(sent[0].html).toContain(
      `href="https://foxing.test/api/auth/magic-link/verify?token=t&amp;callbackURL=&quot;&gt;&lt;script&gt;"`,
    );
    expect(sent[0].html).not.toContain("<script>");
    expect(sent[0].text).toContain(url);
  });
});
