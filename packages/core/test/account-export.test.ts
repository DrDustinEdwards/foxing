import { getTableName, is } from "drizzle-orm";
import { SQLiteTable, getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import {
  ACCOUNT_EXPORT_EXCLUDED,
  ACCOUNT_EXPORT_KEYS,
  USER_SCOPED_TABLE_NAMES,
} from "../src/domain/account";
import * as schema from "../src/schema";

// The export/delete registry is the single source of truth for user-scoped tables.
// This enumerates every schema table with a foreign key to `user` and fails if one
// is neither exported nor explicitly excluded. A user-owned table added later cannot
// silently drop out of the GDPR export: it will land here first.
function tablesReferencingUser(): string[] {
  const names: string[] = [];
  for (const value of Object.values(schema)) {
    if (!is(value, SQLiteTable)) continue;
    const refsUser = getTableConfig(value).foreignKeys.some(
      (fk) => getTableName(fk.reference().foreignTable) === getTableName(schema.user),
    );
    if (refsUser) names.push(getTableName(value));
  }
  return names;
}

describe("account export completeness", () => {
  it("every table with a foreign key to user is exported or explicitly excluded", () => {
    const enumerated = tablesReferencingUser();
    // Sanity: enumeration actually found the user-scoped surface, not zero tables.
    expect(enumerated.length).toBeGreaterThan(10);

    const missing = enumerated.filter(
      (name) => !USER_SCOPED_TABLE_NAMES.has(name) && !ACCOUNT_EXPORT_EXCLUDED.has(name),
    );
    expect(missing).toEqual([]);
  });

  it("export keys are unique and one per registered table", () => {
    expect(new Set(ACCOUNT_EXPORT_KEYS).size).toBe(ACCOUNT_EXPORT_KEYS.length);
    expect(ACCOUNT_EXPORT_KEYS.length).toBe(USER_SCOPED_TABLE_NAMES.size);
  });
});
