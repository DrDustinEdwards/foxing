import { describe, expect, it } from "vitest";
import { resolveEra, resolveLength } from "../src/repositories/catalog/facets";

describe("facet resolvers", () => {
  it("resolves era buckets to year ranges", () => {
    expect(resolveEra("modern")).toMatchObject({ min: 1950, max: 3000 });
    expect(resolveEra("pre-1800")?.max).toBe(1799);
    expect(resolveEra("nope")).toBeUndefined();
    expect(resolveEra(undefined)).toBeUndefined();
  });

  it("resolves length buckets to word-count ranges", () => {
    expect(resolveLength("short")?.max).toBe(39_999);
    expect(resolveLength("long")?.min).toBe(120_001);
    expect(resolveLength(null)).toBeUndefined();
  });
});
