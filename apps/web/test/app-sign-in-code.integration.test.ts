import { env } from "cloudflare:test";
import { RouterContextProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { cloudflareContext } from "../app/context";
import { getAuth } from "../app/lib/auth.server";
import * as library from "../app/routes/library";
import * as login from "../app/routes/login";
import * as passkeyOffer from "../app/routes/passkey-offer";

/** The Worker's env with mail caught instead of sent. */
function mailEnv(secret: string) {
  const sent: Array<{ to: string; text: string }> = [];
  const testEnv = {
    ...env,
    BETTER_AUTH_URL: "https://foxing.app",
    BETTER_AUTH_SECRET: secret,
    EMAIL_FROM: "hello@example.com",
    EMAIL: { send: async (m: { to: string; text: string }) => void sent.push(m) },
  } as unknown as Env;
  return { sent, testEnv };
}

// REGRESSION (2026-10-30): the app's code request answered 404, since the family sign-in turns
// the email OTP send endpoint off unless the site asks for `appCode`. This is the app's flow as
// apps/mobile/app/(auth)/login.tsx makes it (emailOtp.sendVerificationOtp with type sign-in,
// then signIn.emailOtp), through the auth handler, with the mail caught instead of sent.
describe("the app's sign-in code", () => {
  it("is mailed on request and signs in", async () => {
    const { sent, testEnv } = mailEnv("test-secret-value-for-app-code-only");
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

// REGRESSION (2026-11-11): signed-in pages sent a signed-out reader to /login?redirect=..., which
// /login never read, so a reader who signed in from a shelf, club or book landed on /me. This walks
// the way back: the protected page, /login, the emailed code, the passkey offer's "Not now", and
// on to the page they asked for.
const ORIGIN = "https://foxing.app";

async function thrown(run: () => unknown): Promise<Response> {
  try {
    await run();
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }
  throw new Error("expected a redirect");
}

describe("signing in from a protected page", () => {
  it("returns the reader to that page", async () => {
    const { sent, testEnv } = mailEnv("test-secret-value-for-sign-in-return-only");
    const context = new RouterContextProvider();
    context.set(cloudflareContext, {
      env: testEnv,
      ctx: {
        waitUntil() {},
        passThroughOnException() {},
        props: {},
      } as unknown as ExecutionContext,
    });
    const args = (request: Request) => ({ request, context, params: {} }) as never;
    const asked = "/library?shelf=read";

    // The signed-out reader opens their library and is sent to sign in.
    const gate = await thrown(() => library.loader(args(new Request(`${ORIGIN}${asked}`))));
    const signInPage = gate.headers.get("Location") ?? "";
    expect(new URL(signInPage, ORIGIN).pathname).toBe("/login");

    // /login carries the page.
    const { next } = login.loader(args(new Request(new URL(signInPage, ORIGIN))));
    expect(next).toBe(asked);

    // The reader signs in with an emailed code.
    const auth = await getAuth(testEnv);
    const call = (path: string, body: object) =>
      auth.handler(
        new Request(`${ORIGIN}/api/auth${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: ORIGIN },
          body: JSON.stringify(body),
        }),
      );
    const email = "returning-reader@example.com";
    await call("/email-otp/send-verification-otp", { email, type: "sign-in" });
    const code = sent.at(-1)?.text.match(/\b(\d{6})\b/)?.[1];
    expect(code).toBeDefined();
    const signedIn = await call("/sign-in/email-otp", { email, otp: code });
    expect(signedIn.status).toBe(200);
    const cookie = signedIn.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");

    // The passkey offer's "Not now" goes on to the page they asked for.
    const offer = new Request(`${ORIGIN}/passkey?next=${encodeURIComponent(next ?? "")}`, {
      method: "POST",
      headers: { Origin: ORIGIN, Cookie: cookie, "cf-connecting-ip": "203.0.113.7" },
      body: new URLSearchParams({}),
    });
    const back = await thrown(() => passkeyOffer.action(args(offer)));
    expect(back.headers.get("Location")).toBe(asked);
  });
});
