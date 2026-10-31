import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getAuth } from "../app/lib/auth.server";

// Better Auth's own email-change link (/api/auth/verify-email) acts on a GET, so a mail scanner
// that opens links could approve the change. The mail must carry /email/confirm instead, whose
// button's POST is the only thing that acts (site-runtime emailConfirmURL, confirmEmailLink).
describe("changing the email", () => {
  it("mails the confirm page, never Better Auth's GET link", async () => {
    const sent: Array<{ to: string; text: string }> = [];
    const testEnv = {
      ...env,
      BETTER_AUTH_URL: "https://foxing.app",
      BETTER_AUTH_SECRET: "test-secret-value-for-email-change",
      EMAIL_FROM: "hello@example.com",
      EMAIL: { send: async (m: (typeof sent)[number]) => void sent.push(m) },
    } as unknown as Env;
    const auth = await getAuth(testEnv);
    const post = (path: string, body: object, cookie = "") =>
      auth.handler(
        new Request(`https://foxing.app/api/auth${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", origin: "https://foxing.app", cookie },
          body: JSON.stringify(body),
        }),
      );

    const email = "moving-reader@example.com";
    await post("/email-otp/send-verification-otp", { email, type: "sign-in" });
    const otp = sent.at(-1)?.text.match(/\b(\d{6})\b/)?.[1];
    const signedIn = await post("/sign-in/email-otp", { email, otp });
    const cookie =
      signedIn.headers
        .getSetCookie()
        .map((c) => c.split(";")[0])
        .find((c) => c.includes("session_token")) ?? "";

    const res = await post("/change-email", { newEmail: "moved-reader@example.com" }, cookie);
    expect(res.status).toBe(200);
    const mail = sent.at(-1);
    expect(mail?.to).toBe(email);
    expect(mail?.text).toMatch(/https:\/\/foxing\.app\/email\/confirm\?token=[\w.-]+/);
    expect(mail?.text).not.toContain("verify-email");
  });
});
