import { describe, expect, it } from "vitest";
import { parseFactCheck } from "../src/companion/fact-check";

const fence = (json: string) => `I checked it.\n\`\`\`json\n${json}\n\`\`\``;

function read(reply: string) {
  const parsed = parseFactCheck(reply);
  if ("error" in parsed) throw new Error(parsed.error);
  return parsed;
}

describe("parseFactCheck", () => {
  it("reads the last json fence, with corrections, and a reply that is not quite JSON", () => {
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
      }),
    );
    const parsed = read(reply);
    expect(parsed.texts.book_description).toEqual({
      verdict: "fixed",
      issues: ["poison was in the tonic"],
      corrected: "Fixed.",
    });
    expect(parsed.texts.author_bio.verdict).toBe("ok");

    // A corrected text with real newlines in it (JSON forbids them), and a reply with no fence or text after the JSON.
    const json = '{"texts":{"a":{"verdict":"fixed","issues":[],"corrected":"One.\n\nTwo."}}}';
    expect(read(fence(json)).texts.a.corrected).toBe("One.\n\nTwo.");
    expect(read(`${json}\nDone.`).texts.a.verdict).toBe("fixed");
  });

  it("reads a fix with no corrected text as an empty text, and refuses an unknown verdict and a reply that is not JSON", () => {
    expect(read(fence('{"texts":{"a":{"verdict":"fixed","issues":[]}}}')).texts.a).toEqual({
      verdict: "fixed",
      issues: [],
      corrected: "",
    });
    expect(parseFactCheck(fence('{"texts":{"a":{"verdict":"maybe"}}}'))).toEqual({
      error: 'a has the verdict "maybe"',
    });
    expect(parseFactCheck("All good.")).toHaveProperty("error");
  });
});
