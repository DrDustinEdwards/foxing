import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getAuth } from "../app/lib/auth.server";

// Google OAuth cannot be exercised end to end without a real Google handshake, so this
// verifies the wiring: the callback route the Google console points at
// (/api/auth/callback/google) is served by the auth handler rather than falling through
// to a 404. Secrets are absent in the test env, so a fake pair is injected.
function testEnv() {
  return {
    ...env,
    BETTER_AUTH_URL: "https://foxing.app",
    BETTER_AUTH_SECRET: "test-secret-value-for-config-only",
    GOOGLE_CLIENT_ID: "test-google-client-id",
    GOOGLE_CLIENT_SECRET: "test-google-client-secret",
  } as unknown as Env;
}

describe("auth config", () => {
  it("serves the Google callback route (not a 404 fall-through)", async () => {
    const auth = await getAuth(testEnv());
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
