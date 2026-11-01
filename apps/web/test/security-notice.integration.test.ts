import { env } from "cloudflare:test";
import { createDb, schema } from "@foxing/core";
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { deleteUserAccount, getAuth, sessionUserFromRequest } from "../app/lib/auth.server";
import { testApi } from "./test-api";

let harnesses = 0;

/** Foxing's auth with its mail caught in `sent`, a POST to /api/auth, and a sign-in by code
 *  that answers the session cookie (the device cookie, sessionDetails, comes with it). Each
 *  harness is its own address (cf-connecting-ip), so the per-IP sign-in limit is its own. */
async function signInHarness(secret: string) {
  const ip = `203.0.113.${++harnesses}`;
  const sent: Array<{ to: string; subject: string; text: string }> = [];
  const testEnv = {
    ...env,
    BETTER_AUTH_URL: "https://foxing.app",
    BETTER_AUTH_SECRET: secret,
    EMAIL_FROM: "hello@example.com",
    EMAIL: { send: async (m: (typeof sent)[number]) => void sent.push(m) },
  } as unknown as Env;
  const auth = await getAuth(testEnv);
  const post = (path: string, body: object, cookie = "") =>
    auth.handler(
      new Request(`https://foxing.app/api/auth${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          origin: "https://foxing.app",
          "cf-connecting-ip": ip,
          cookie,
        },
        body: JSON.stringify(body),
      }),
    );
  const signIn = async (email: string) => {
    await post("/email-otp/send-verification-otp", { email, type: "sign-in" });
    const otp = sent.at(-1)?.text.match(/\b(\d{6})\b/)?.[1];
    const res = await post("/sign-in/email-otp", { email, otp });
    expect(res.status).toBe(200);
    return (
      res.headers
        .getSetCookie()
        .map((c) => c.split(";")[0])
        .find((c) => c.includes("session_token")) ?? ""
    );
  };
  return { sent, testEnv, auth, post, signIn };
}

// Signing out every other device (settings, Signed-in devices) ends those sessions and mails the
// reader a security notice through Foxing's own sender, after the answer (waitUntil).
describe("signing out the other devices", () => {
  it("ends them and mails a security notice", async () => {
    const { sent, auth, post, signIn } = await signInHarness("test-secret-value-for-notice-only");

    // Two devices: each asks for a code and signs in with it.
    const email = "notice-reader@example.com";
    const here = await signIn(email);
    await signIn(email);

    const headers = new Headers({ cookie: here });
    expect(await auth.api.listSessions({ headers })).toHaveLength(2);
    expect((await post("/revoke-other-sessions", {}, here)).status).toBe(200);
    expect(await auth.api.listSessions({ headers })).toHaveLength(1);

    await vi.waitFor(() => expect(sent.at(-1)?.subject).toMatch(/^Foxing: /));
    expect(sent.at(-1)?.to).toBe(email);
    expect(sent.at(-1)?.text).toContain("https://foxing.app/settings");
  });
});

// Better Auth's own email-change link (/api/auth/verify-email) acts on a GET, so a mail scanner
// that opens links could approve the change. The mail carries /email/confirm instead, whose
// button's POST is the only thing that acts (site-runtime emailConfirmURL, confirmEmailLink).
describe("changing the email", () => {
  it("mails the confirm page, never Better Auth's GET link", async () => {
    const { sent, post, signIn } = await signInHarness("test-secret-value-for-email-change");
    const email = "moving-reader@example.com";
    const cookie = await signIn(email);

    const res = await post("/change-email", { newEmail: "moved-reader@example.com" }, cookie);
    expect(res.status).toBe(200);
    expect(sent.at(-1)?.to).toBe(email);
    expect(sent.at(-1)?.text).toMatch(/https:\/\/foxing\.app\/email\/confirm\?token=[\w.-]+/);
    expect(sent.at(-1)?.text).not.toContain("verify-email");
  });
});

// Deleting the account (Settings, DELETE /api/v1/account) is Better Auth's deleteUser: Foxing's
// own rows go first, then the sessions and the user, and the reader is told.
describe("deleting the account", () => {
  it("removes the user and their sessions through Better Auth and mails a notice", async () => {
    const { sent, testEnv, auth, signIn } = await signInHarness(
      "test-secret-value-for-delete-only",
    );
    const email = "leaving-reader@example.com";
    const cookie = await signIn(email);

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

// A signed-in page's loader reads the session from its GET (sessionLookup, with the request for
// sessionDetails' place). Better Auth answers a call that carries a request with a Response
// unless asked not to, which once sent every signed-in reader back to /login.
describe("a signed-in GET", () => {
  it("finds the reader's session", async () => {
    const { testEnv, signIn } = await signInHarness("test-secret-value-for-get-session");
    const email = "returning-reader@example.com";
    const cookie = await signIn(email);

    const page = new Request("https://foxing.app/me", { headers: { cookie } });
    expect(await sessionUserFromRequest(page, testEnv)).toMatchObject({ email });
  });
});
