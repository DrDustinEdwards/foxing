// OAuth tokens at rest (Grok audit 2026-10-21, FX-3). Better Auth encrypts every token it
// writes once `account.encryptOAuthTokens` is on (apps/web/app/lib/auth.server.ts), and it
// reads a plaintext token as it is. This finds the tokens stored before that, or by any
// path that skipped it, and encrypts them in place with the caller's `encrypt`.
import { eq, isNotNull, or } from "drizzle-orm";
import type { Db } from "../db";
import { account } from "../schema";

const TOKEN_COLUMNS = ["accessToken", "refreshToken", "idToken"] as const;

/**
 * Better Auth's own test for ciphertext (isLikelyEncrypted, better-auth/dist/oauth2/utils):
 * its versioned envelope, or bare hex of even length. A Google token is never that: access
 * tokens hold dots, refresh tokens slashes, ID tokens are dot-separated JWTs.
 */
export function isEncryptedToken(value: string): boolean {
  return value.startsWith("$ba$") || (value.length % 2 === 0 && /^[0-9a-f]+$/i.test(value));
}

/** Encrypts each plaintext token in `account`. Returns how many rows it rewrote. */
export async function encryptPlaintextOAuthTokens(
  db: Db,
  encrypt: (plaintext: string) => Promise<string>,
): Promise<number> {
  const rows = await db
    .select({
      id: account.id,
      accessToken: account.accessToken,
      refreshToken: account.refreshToken,
      idToken: account.idToken,
    })
    .from(account)
    .where(
      or(
        isNotNull(account.accessToken),
        isNotNull(account.refreshToken),
        isNotNull(account.idToken),
      ),
    );

  let rewritten = 0;
  for (const row of rows) {
    const patch: Partial<Record<(typeof TOKEN_COLUMNS)[number], string>> = {};
    for (const column of TOKEN_COLUMNS) {
      const value = row[column];
      if (value && !isEncryptedToken(value)) patch[column] = await encrypt(value);
    }
    if (Object.keys(patch).length === 0) continue;
    await db.update(account).set(patch).where(eq(account.id, row.id));
    rewritten += 1;
  }
  return rewritten;
}
