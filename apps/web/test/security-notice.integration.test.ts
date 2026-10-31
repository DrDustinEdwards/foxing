import { env } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";
import { getAuth } from "../app/lib/auth.server";

// Signing out every other device (settings, Signed-in devices) ends those sessions and mails the
// reader a security notice through Foxing's own sender, after the answer (waitUntil).
describe("signing out the other devices", () => {
  it("ends them and mails a security notice", async () => {
    const sent: Array<{ to: string; subject: string; text: string }> = [];
    const testEnv = {
      ...env,
      BETTER_AUTH_URL: "https://foxing.app",
      BETTER_AUTH_SECRET: "test-secret-value-for-notice-only",
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

    // Two devices: each asks for a code and signs in with it.
    const email = "notice-reader@example.com";
    const signIn = async () => {
      await post("/email-otp/send-verification-otp", { email, type: "sign-in" });
      const otp = sent.at(-1)?.text.match(/\b(\d{6})\b/)?.[1];
      const res = await post("/sign-in/email-otp", { email, otp });
      expect(res.status).toBe(200);
      return (res.headers.get("set-cookie") ?? "").split(";")[0];
    };
    const here = await signIn();
    await signIn();

    const headers = new Headers({ cookie: here });
    expect(await auth.api.listSessions({ headers })).toHaveLength(2);
    expect((await post("/revoke-other-sessions", {}, here)).status).toBe(200);
    expect(await auth.api.listSessions({ headers })).toHaveLength(1);

    await vi.waitFor(() => expect(sent.at(-1)?.subject).toMatch(/^Foxing: /));
    expect(sent.at(-1)?.to).toBe(email);
    expect(sent.at(-1)?.text).toContain("https://foxing.app/settings");
  });
});
