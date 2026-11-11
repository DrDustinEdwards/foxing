import { drizzle } from "drizzle-orm/d1";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { D1_MAX_BOUND_PARAMS, rowsPerInsert } from "../src/db";
import { notifications } from "../src/schema";

// D1 refuses a statement with more than 100 bound parameters. A broadcast once
// inserted 200 notification rows at a time and failed past about 14 readers. chunked and rowsPerInsert
// themselves are tested in site-runtime ./d1; this proves the notifications table fits.
describe("D1 chunking", () => {
  it("a full notifications insert chunk binds at most 100 parameters", () => {
    const db = drizzle({} as D1Database);
    const columns = Object.keys(getTableColumns(notifications)).length;
    const size = rowsPerInsert(columns);
    const row = {
      id: "n",
      userId: "u",
      type: "system",
      title: "t",
      body: "b",
    } as typeof notifications.$inferInsert;
    const { params } = db
      .insert(notifications)
      .values(Array.from({ length: size }, () => row))
      .toSQL();
    expect(params.length).toBeLessThanOrEqual(D1_MAX_BOUND_PARAMS);
    expect(size).toBeGreaterThan(0);
  });
});
