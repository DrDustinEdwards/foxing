import { describe, expect, it } from "vitest";
import { normalizeText } from "../src/domain/text";

describe("normalizeText (popular-highlights key)", () => {
  it("collapses case, whitespace, and punctuation to a stable key", () => {
    expect(normalizeText("  The  Quick, Brown Fox!  ")).toBe("the quick brown fox");
  });

  it("strips combining diacritics so accented and plain text share a key", () => {
    const eAcute = `cafe${String.fromCharCode(0x0301)}`; // cafe + combining acute
    expect(normalizeText(eAcute)).toBe("cafe");
    expect(normalizeText(eAcute)).toBe(normalizeText("CAFE"));
  });
});
