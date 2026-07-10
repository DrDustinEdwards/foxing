import { env } from "cloudflare:test";
import { ACCOUNT_EXPORT_KEYS, createDb, exportAccount } from "@foxing/core";
import { describe, expect, it } from "vitest";

// Structural check on the export payload, run against the real (local) D1 schema.
// It calls the core export function directly with a user id: no forged session, no
// HTTP, no UI claim. It proves the archive has an array key for every registered
// user-owned table even when the user has no rows, so a table cannot silently drop
// out of the export. Row-level GDPR correctness is Fable's independent verification.
describe("account export payload", () => {
  it("returns an array key for every user-owned table", async () => {
    const db = createDb(env.DB);
    const data = await exportAccount(db, "no-such-user-id");

    expect(Object.keys(data).sort()).toEqual([...ACCOUNT_EXPORT_KEYS].sort());
    for (const key of ACCOUNT_EXPORT_KEYS) {
      expect(Array.isArray(data[key])).toBe(true);
    }
  });
});
