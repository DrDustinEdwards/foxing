import { env } from "cloudflare:test";
import { createDb, schema } from "@foxing/core";
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { deleteUserAccount, getAuth, sessionUserFromRequest } from "../app/lib/auth.server";
import { testApi } from "./test-api";

/** The session cookie a sign-in set; the device cookie (sessionDetails) comes with it. */
const sessionCookie = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .find((c) => c.includes("session_token")) ?? "";

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
      return sessionCookie(res);
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

// Deleting the account (Settings, DELETE /api/v1/account) is Better Auth's deleteUser: Foxing's
// own rows go first, then the sessions and the user, and the reader is told.
describe("deleting the account", () => {
  it("removes the user and their sessions through Better Auth and mails a notice", async () => {
    const sent: Array<{ to: string; subject: string; text: string }> = [];
    const testEnv = {
      ...env,
      BETTER_AUTH_URL: "https://foxing.app",
      BETTER_AUTH_SECRET: "test-secret-value-for-delete-only",
      EMAIL_FROM: "hello@example.com",
      EMAIL: { send: async (m: (typeof sent)[number]) => void sent.push(m) },
    } as unknown as Env;
    const auth = await getAuth(testEnv);
    const email = "leaving-reader@example.com";
    const post = (path: string, body: object) =>
      auth.handler(
        new Request(`https://foxing.app/api/auth${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", origin: "https://foxing.app" },
          body: JSON.stringify(body),
        }),
      );
    await post("/email-otp/send-verification-otp", { email, type: "sign-in" });
    const otp = sent.at(-1)?.text.match(/\b(\d{6})\b/)?.[1];
    const signedIn = await post("/sign-in/email-otp", { email, otp });
    const cookie = sessionCookie(signedIn);

    const api = testApi({
      resolveSession: (req) => sessionUserFromRequest(req, testEnv),
      deleteUser: (req, _e, { successors }) => deleteUserAccount(req, testEnv, successors),
    });
    const res = await api.fetch(
      new Request("https://foxing.app/account", {
        method: "DELETE",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ successors: {} }),
      }),
      testEnv as never,
    );
    expect(res.status).toBe(204);

    const db = createDb(env.DB);
    expect(await db.select().from(schema.user).where(eq(schema.user.email, email))).toHaveLength(0);
    expect(await auth.api.getSession({ headers: new Headers({ cookie }) })).toBeNull();
    await vi.waitFor(() => expect(sent.at(-1)?.text).toContain("were deleted"));
    expect(sent.at(-1)?.to).toBe(email);
  });
});
