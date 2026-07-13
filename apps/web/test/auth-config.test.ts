import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getAuth } from "../app/lib/auth.server";

// Google OAuth cannot be exercised end to end without a real Google handshake, so this
// suite verifies the wiring instead: the provider is configured, account linking trusts
// it, the magic-link plugin is registered, and the callback route the Google console
// points at (/api/auth/callback/google) is actually served by the auth handler rather
// than falling through to a 404. Secrets are absent in the test env, so a fake pair is
// injected purely to prove the config path.
function testEnv() {
  return {
    ...env,
    BETTER_AUTH_URL: "https://foxing.app",
    BETTER_AUTH_SECRET: "test-secret-value-for-config-only",
    GOOGLE_CLIENT_ID: "test-google-client-id",
    GOOGLE_CLIENT_SECRET: "test-google-client-secret",
    TURNSTILE_ENABLED: "false",
  } as unknown as Env;
}

describe("auth config", () => {
  it("registers Google as a social provider from env", () => {
    const auth = getAuth(testEnv());
    const google = auth.options.socialProviders?.google;
    expect(google?.clientId).toBe("test-google-client-id");
    expect(google?.clientSecret).toBe("test-google-client-secret");
  });

  it("trusts Google for account linking so a matching verified email links, not duplicates", () => {
    const auth = getAuth(testEnv());
    expect(auth.options.account?.accountLinking?.enabled).toBe(true);
    expect(auth.options.account?.accountLinking?.trustedProviders).toContain("google");
  });

  it("registers the magic-link plugin", () => {
    const auth = getAuth(testEnv());
    const ids = (auth.options.plugins ?? []).map((p) => p.id);
    expect(ids).toContain("magic-link");
  });

  it("serves the Google callback route (not a 404 fall-through)", async () => {
    const auth = getAuth(testEnv());
    // No oauth state/code: the handler must recognise the route and redirect to its
    // error screen. A 404 would mean the provider was never registered.
    const res = await auth.handler(
      new Request("https://foxing.app/api/auth/callback/google", { redirect: "manual" }),
    );
    expect(res.status).not.toBe(404);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
  });
});
