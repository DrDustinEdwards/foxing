import { describe, expect, it } from "vitest";
import { parseFactCheck } from "../src/companion/fact-check";

const fence = (json: string) => `I checked it.\n\`\`\`json\n${json}\n\`\`\``;

describe("parseFactCheck", () => {
  it("reads the last json fence, with corrections and sources, and a reply that is not quite JSON", () => {
    const reply = fence(
      JSON.stringify({
        texts: {
          book_description: {
            verdict: "fixed",
            issues: ["poison was in the tonic"],
            corrected: "Fixed.",
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
      corrected: "Fixed.",
    });
    expect(parsed?.texts.author_bio.verdict).toBe("ok");

    // A corrected text with real newlines in it (JSON forbids them), and a reply with no fence or text after the JSON.
    const json = '{"texts":{"a":{"verdict":"fixed","issues":[],"corrected":"One.\n\nTwo."}}}';
    expect(parseFactCheck(fence(json))?.texts.a.corrected).toBe("One.\n\nTwo.");
    expect(parseFactCheck(`${json}\nDone.`)?.texts.a.verdict).toBe("fixed");
  });

  it("refuses a fix with no corrected text, an unknown verdict and a reply that is not JSON", () => {
    expect(parseFactCheck(fence('{"texts":{"a":{"verdict":"fixed","issues":[]}}}'))).toBeNull();
    expect(parseFactCheck(fence('{"texts":{"a":{"verdict":"maybe"}}}'))).toBeNull();
    expect(parseFactCheck("All good.")).toBeNull();
  });
});
