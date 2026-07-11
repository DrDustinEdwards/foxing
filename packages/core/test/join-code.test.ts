import { describe, expect, it } from "vitest";
import { generateJoinCode } from "../src/repositories/clubs";

describe("generateJoinCode", () => {
  it("is 10 chars from an unambiguous uppercase/digit alphabet", () => {
    const code = generateJoinCode();
    expect(code).toHaveLength(10);
    expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/);
    // No lookalike characters (0/O/1/I/L) so codes are safe to read aloud/deep-link.
    expect(code).not.toMatch(/[0O1IL]/);
  });

  it("produces a fresh code each call (regeneration invalidates the old one)", () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateJoinCode()));
    expect(codes.size).toBe(200);
  });
});
