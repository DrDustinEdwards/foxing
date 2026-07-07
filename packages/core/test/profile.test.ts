import { describe, expect, it } from "vitest";
import { normalizeText } from "../src/domain/text";
import { onboardInput, username } from "../src/validators/profile";

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

describe("username validator", () => {
  it("lowercases and accepts valid handles", () => {
    expect(username.parse("Dustin_01")).toBe("dustin_01");
  });

  it("rejects too-short handles and illegal characters", () => {
    expect(() => username.parse("ab")).toThrow();
    expect(() => username.parse("has space")).toThrow();
  });
});

describe("onboardInput", () => {
  it("requires a username and caps favoriteGenres at 20", () => {
    expect(onboardInput.parse({ username: "reader99" }).username).toBe("reader99");
    expect(() =>
      onboardInput.parse({
        username: "reader99",
        favoriteGenres: Array.from({ length: 21 }, (_, i) => `g${i}`),
      }),
    ).toThrow();
  });
});
