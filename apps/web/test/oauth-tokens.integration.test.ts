import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getAuth } from "../app/lib/auth.server";

// FX-3: Foxing stores no Google tokens. A Google sign-in's account writes (createOAuthUser on
// sign-up, updateAccount on each later sign-in) keep none, and migration 0005 clears the rows
// stored before. Fake tokens and a fake secret.
const testEnv = {
  ...env,
  BETTER_AUTH_URL: "https://foxing.app",
  BETTER_AUTH_SECRET: "test-secret-value-for-oauth-tokens-only",
} as unknown as Env;

const TOKENS = {
  accessToken: "ya29.a0-fake-access-token",
  refreshToken: "1//0fake-refresh-token",
  idToken: "eyJhbGciOiJub25lIn0.eyJzdWIiOiJzYW1wbGUifQ.",
  accessTokenExpiresAt: new Date(Date.now() + 3_600_000),
};

const tokensOf = (id: string) =>
  env.DB.prepare(
    "SELECT access_token, refresh_token, id_token, access_token_expires_at FROM account WHERE id = ?",
  )
    .bind(id)
    .first();
const NONE = {
  access_token: null,
  refresh_token: null,
  id_token: null,
  access_token_expires_at: null,
};

describe("Google tokens", () => {
  it("are never stored, and migration 0005 clears old ones", async () => {
    const { internalAdapter } = await (await getAuth(testEnv)).$context;
    const { account } = await internalAdapter.createOAuthUser(
      { name: "Sample", email: "oauth@example.com", emailVerified: true },
      { providerId: "google", accountId: "g-1", ...TOKENS },
    );
    expect(await tokensOf(account.id)).toEqual(NONE);
    await internalAdapter.updateAccount(account.id, TOKENS);
    expect(await tokensOf(account.id)).toEqual(NONE);

    const now = Date.now();
    await env.DB.prepare(
      "INSERT INTO account (id, account_id, provider_id, user_id, access_token, refresh_token, id_token, access_token_expires_at, created_at, updated_at) VALUES ('a-old', 'g-2', 'google', ?, 'a', 'r', 'i', ?, ?, ?)",
    )
      .bind(account.userId, now, now, now)
      .run();
    const migration = env.TEST_MIGRATIONS.find((m) => m.name.startsWith("0005_"));
    for (const query of migration?.queries ?? []) await env.DB.prepare(query).run();
    expect(migration).toBeDefined();
    expect(await tokensOf("a-old")).toEqual(NONE);
  });
});
