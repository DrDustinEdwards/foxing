import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getAuth } from "../app/lib/auth.server";

// REGRESSION (2026-10-30): the app's code request answered 404, since the family sign-in turns
// the email OTP send endpoint off unless the site asks for `appCode`. This is the app's flow as
// apps/mobile/app/(auth)/login.tsx makes it (emailOtp.sendVerificationOtp with type sign-in,
// then signIn.emailOtp), through the auth handler, with the mail caught instead of sent.
describe("the app's sign-in code", () => {
  it("is mailed on request and signs in", async () => {
    const sent: Array<{ to: string; text: string }> = [];
    const testEnv = {
      ...env,
      BETTER_AUTH_URL: "https://foxing.app",
      BETTER_AUTH_SECRET: "test-secret-value-for-app-code-only",
      EMAIL_FROM: "hello@example.com",
      EMAIL: { send: async (m: { to: string; text: string }) => void sent.push(m) },
    } as unknown as Env;
    const auth = await getAuth(testEnv);
    const post = (path: string, body: object) =>
      auth.handler(
        new Request(`https://foxing.app/api/auth${path}`, {
          method: "POST",
          // What the Expo client sends in place of a browser's Origin.
          headers: { "Content-Type": "application/json", "expo-origin": "foxing://" },
          body: JSON.stringify(body),
        }),
      );

    const email = "app-reader@example.com";
    const ask = await post("/email-otp/send-verification-otp", { email, type: "sign-in" });
    expect(ask.status).toBe(200);
    const code = sent[0]?.text.match(/\b(\d{6})\b/)?.[1];
    expect(sent[0]?.to).toBe(email);
    expect(code).toBeDefined();

    const signIn = await post("/sign-in/email-otp", { email, otp: code });
    expect(signIn.status).toBe(200);
    expect(((await signIn.json()) as { user?: { email: string } }).user?.email).toBe(email);
  });
});
