import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { encryptStoredOAuthTokens, getAuth } from "../app/lib/auth.server";

// FX-3: Google's tokens are not kept in plaintext. A row stored before encryption was on is
// encrypted in place by the daily cron's encryptStoredOAuthTokens, and Better Auth still
// reads it back with the same secret. Fake tokens and a fake secret.
const testEnv = {
  ...env,
  BETTER_AUTH_URL: "https://foxing.app",
  BETTER_AUTH_SECRET: "test-secret-value-for-oauth-tokens-only",
  GOOGLE_CLIENT_ID: "test-google-client-id",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret",
  TURNSTILE_ENABLED: "false",
} as unknown as Env;

const PLAIN = {
  access: "ya29.a0-fake-access-token",
  refresh: "1//0fake-refresh-token",
  id: "eyJhbGciOiJub25lIn0.eyJzdWIiOiJzYW1wbGUifQ.",
};

async function storedTokens(id: string) {
  return env.DB.prepare(
    "SELECT access_token, refresh_token, id_token, password FROM account WHERE id = ?",
  )
    .bind(id)
    .first<{ access_token: string; refresh_token: string; id_token: string; password: null }>();
}

describe("OAuth tokens at rest", () => {
  it("encrypts plaintext tokens once, and Better Auth reads them back", async () => {
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES ('u-oauth', 'Sample', 'oauth@example.com', 1, ?, ?)",
      ).bind(now, now),
      env.DB.prepare(
        "INSERT INTO account (id, account_id, provider_id, user_id, access_token, refresh_token, id_token, access_token_expires_at, created_at, updated_at) VALUES ('a-oauth', 'g-1', 'google', 'u-oauth', ?, ?, ?, ?, ?, ?)",
      ).bind(PLAIN.access, PLAIN.refresh, PLAIN.id, now + 3_600_000, now, now),
    ]);

    expect(await encryptStoredOAuthTokens(testEnv)).toBe(1);
    const stored = await storedTokens("a-oauth");
    expect(stored?.access_token).not.toContain(PLAIN.access);
    expect(stored?.refresh_token).not.toContain(PLAIN.refresh);
    expect(stored?.id_token).not.toContain(PLAIN.id);
    expect(stored?.password).toBeNull();

    // A second run finds nothing to do and never encrypts twice.
    expect(await encryptStoredOAuthTokens(testEnv)).toBe(0);
    expect(await storedTokens("a-oauth")).toEqual(stored);

    const token = await getAuth(testEnv).api.getAccessToken({
      body: { providerId: "google", userId: "u-oauth" },
    });
    expect(token.accessToken).toBe(PLAIN.access);
  });
});
