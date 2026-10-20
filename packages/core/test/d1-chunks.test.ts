import { drizzle } from "drizzle-orm/d1";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { chunked, D1_MAX_BOUND_PARAMS, IN_LIST_CHUNK, rowsPerInsert } from "../src/db";
import { notifications } from "../src/schema";

// D1 refuses a statement with more than 100 bound parameters. A broadcast once
// inserted 200 notification rows at a time and failed past about 14 readers.
describe("D1 chunking", () => {
  it("splits in order and keeps every item", () => {
    const items = Array.from({ length: 205 }, (_, i) => i);
    const parts = chunked(items);
    expect(parts.map((p) => p.length)).toEqual([IN_LIST_CHUNK, IN_LIST_CHUNK, 25]);
    expect(parts.flat()).toEqual(items);
    expect(chunked([])).toEqual([]);
  });

  it("an IN list chunk stays under the limit", () => {
    expect(IN_LIST_CHUNK).toBeLessThanOrEqual(D1_MAX_BOUND_PARAMS);
  });

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
