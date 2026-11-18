import { describe, expect, it } from "vitest";
import { applyFixes, parseFactCheck } from "../src/companion/fact-check";

const fence = (json: string) => `I checked it.\n\`\`\`json\n${json}\n\`\`\``;

describe("parseFactCheck", () => {
  it("reads the last json fence, with corrections and sources, and a reply that is not quite JSON", () => {
    const reply = fence(
      JSON.stringify({
        texts: {
          book_description: {
            verdict: "fixed",
            issues: ["poison was in the tonic"],
            fixes: [{ find: "the tonic", replace: "the coffee" }],
          },
          author_bio: { verdict: "ok", issues: [] },
        },
        sources: ["https://en.wikipedia.org/wiki/The_Mysterious_Affair_at_Styles"],
      }),
    );
    const parsed = parseFactCheck(reply);
    expect(parsed?.texts.book_description).toEqual({
      verdict: "fixed",
      issues: ["poison was in the tonic"],
      fixes: [{ find: "the tonic", replace: "the coffee" }],
    });
    expect(parsed?.texts.author_bio.verdict).toBe("ok");
  });

  it("refuses a fix with no fixes, an unknown verdict and a reply that is not JSON", () => {
    expect(parseFactCheck(fence('{"texts":{"a":{"verdict":"fixed","issues":[]}}}'))).toBeNull();
    expect(parseFactCheck(fence('{"texts":{"a":{"verdict":"maybe"}}}'))).toBeNull();
    expect(parseFactCheck("All good.")).toBeNull();
  });
});

describe("applyFixes", () => {
  it("replaces each phrase, removes a claim with an empty replacement, and refuses one that does not match once", () => {
    const text = "Poirot arrives in 1916. The tonic was poisoned. Hastings narrates.";
    expect(
      applyFixes(text, [
        { find: "1916", replace: "1917" },
        { find: " The tonic was poisoned.", replace: "" },
      ]),
    ).toBe("Poirot arrives in 1917. Hastings narrates.");
    expect(applyFixes(text, [{ find: "Watson", replace: "Hastings" }])).toBeNull();
    expect(applyFixes("a b a", [{ find: "a", replace: "c" }])).toBeNull();
  });
});
