import { env } from "cloudflare:test";
import { RouterContextProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { cloudflareContext } from "../app/context";
import { getAuth } from "../app/lib/auth.server";
import * as library from "../app/routes/library";
import * as login from "../app/routes/login";
import * as passkeyOffer from "../app/routes/passkey-offer";

// REGRESSION (2026-11-11): the signed-in pages sent a signed-out reader to /login?redirect=...,
// which /login never read, so a reader who signed in from a club, a shelf or a book's page landed
// on /me instead. This walks the whole way back as a reader does: the protected page, /login, the
// emailed code, the passkey offer's "Not now", and on to the page they asked for.
const ORIGIN = "https://foxing.app";

function harness() {
  const sent: Array<{ to: string; text: string }> = [];
  const testEnv = {
    ...env,
    BETTER_AUTH_URL: ORIGIN,
    BETTER_AUTH_SECRET: "test-secret-value-for-sign-in-return-only",
    EMAIL_FROM: "hello@example.com",
    EMAIL: { send: async (m: { to: string; text: string }) => void sent.push(m) },
  } as unknown as Env;
  const context = new RouterContextProvider();
  context.set(cloudflareContext, {
    env: testEnv,
    ctx: { waitUntil() {}, passThroughOnException() {}, props: {} } as unknown as ExecutionContext,
  });
  return { sent, context, testEnv };
}

/** What a route threw: React Router's redirects are thrown Responses. */
async function thrown(run: () => unknown): Promise<Response> {
  try {
    await run();
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }
  throw new Error("expected a redirect");
}

const post = (path: string, fields: Record<string, string>, cookie?: string) =>
  new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: {
      Origin: ORIGIN,
      "cf-connecting-ip": "203.0.113.7",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: new URLSearchParams(fields),
  });

describe("signing in from a protected page", () => {
  it("returns the reader to that page", async () => {
    const { sent, context, testEnv } = harness();
    const args = (request: Request) => ({ request, context, params: {} }) as never;
    const asked = "/library?shelf=read";

    // The signed-out reader opens their library and is sent to sign in.
    const gate = await thrown(() => library.loader(args(new Request(`${ORIGIN}${asked}`))));
    const signInPage = gate.headers.get("Location") ?? "";
    expect(new URL(signInPage, ORIGIN).pathname).toBe("/login");

    // /login carries the page in every form.
    const { next } = login.loader(args(new Request(new URL(signInPage, ORIGIN))));
    expect(next).toBe(asked);

    // The code is mailed (here by the app's code request: the page's own link request needs a
    // passed Turnstile check, which a test cannot make), then the reader types it on /login.
    const email = "returning-reader@example.com";
    const auth = await getAuth(testEnv);
    await auth.handler(
      new Request(`${ORIGIN}/api/auth/email-otp/send-verification-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: ORIGIN },
        body: JSON.stringify({ email, type: "sign-in" }),
      }),
    );
    const code = sent.at(-1)?.text.match(/\b(\d{6})\b/)?.[1];
    expect(code).toBeDefined();
    const signedIn = await thrown(() =>
      login.action(
        args(post(signInPage, { intent: "code", email, code: code ?? "", next: next ?? "" })),
      ),
    );
    const cookie = signedIn.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");

    // By way of the passkey offer, where "Not now" goes on.
    const offer = signedIn.headers.get("Location") ?? "";
    expect(new URL(offer, ORIGIN).pathname).toBe("/passkey");
    const back = await thrown(() => passkeyOffer.action(args(post(offer, {}, cookie))));
    expect(back.headers.get("Location")).toBe(asked);
  });
});
