import { describe, expect, it } from "vitest";
import {
  CACHED_ACTION_NAMES,
  COMPANION_REGISTRY,
  type CompanionContext,
  getCompanionAction,
  PLUS_ACTION_NAMES,
} from "../src/companion/registry";
import {
  estimateCostCents,
  MAX_OUTPUT_TOKENS,
  MODELS,
  resolveModel,
} from "../src/companion/models";

const FIXTURE_BOOK = {
  id: "book-1",
  title: "Pride and Prejudice",
  author: "Jane Austen",
  description: "A comedy of manners.",
  publicationYear: 1813,
  subjects: ["fiction", "romance"],
};

function fixtureContext(overrides: Partial<CompanionContext> = {}): CompanionContext {
  return {
    action: overrides.action ?? "chat",
    book: FIXTURE_BOOK,
    selection: { text: "It is a truth universally acknowledged", chapter: "Chapter 1" },
    chapter: "Chapter 1",
    message: "What do you think of Mr. Darcy?",
    targetLanguage: "Spanish",
    history: [],
    ...overrides,
  };
}

describe("companion registry integrity", () => {
  it("has exactly 15 Plus actions and 4 free-cached actions, per free-vs-paid.md (D11)", () => {
    expect(PLUS_ACTION_NAMES).toHaveLength(15);
    expect(CACHED_ACTION_NAMES).toHaveLength(4);
    expect(COMPANION_REGISTRY).toHaveLength(19);
  });

  it("names the exact D11 Plus action list", () => {
    expect(new Set(PLUS_ACTION_NAMES)).toEqual(
      new Set([
        "word_lookup",
        "passage_analysis",
        "chat",
        "word_aspect",
        "language_difficulty",
        "deep_dive",
        "semantic_search",
        "discussion_starter",
        "word_wise",
        "character_map",
        "chapter_feature",
        "bilingual_paragraph",
        "recommendations",
        "reading_personality",
        "book_insight",
      ]),
    );
  });

  it("names the exact 4 free-cached catalog generators", () => {
    expect(new Set(CACHED_ACTION_NAMES)).toEqual(
      new Set(["book_description", "author_bio", "similar_books", "reading_order"]),
    );
  });

  it("has no duplicate action names", () => {
    const names = COMPANION_REGISTRY.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("assigns tier consistently with the action's list membership", () => {
    for (const action of COMPANION_REGISTRY) {
      if (PLUS_ACTION_NAMES.includes(action.name)) expect(action.tier).toBe("plus");
      if (CACHED_ACTION_NAMES.includes(action.name)) expect(action.tier).toBe("free-cached");
    }
  });

  it("assigns every action a role that resolves to a pinned model", () => {
    for (const action of COMPANION_REGISTRY) {
      expect(Object.keys(MODELS)).toContain(action.role);
    }
  });

  it("assigns the fixed fast-role actions per the Phase 4a plan", () => {
    const fast = COMPANION_REGISTRY.filter((a) => a.role === "fast").map((a) => a.name);
    expect(new Set(fast)).toEqual(
      new Set(["word_lookup", "word_aspect", "word_wise", "language_difficulty"]),
    );
  });

  it("assigns the fixed deep-role actions per the Phase 4a plan", () => {
    const deep = COMPANION_REGISTRY.filter((a) => a.role === "deep").map((a) => a.name);
    expect(new Set(deep)).toEqual(new Set(["deep_dive", "reading_personality"]));
  });

  it("assigns standard role to every other Plus action and all 4 cached generators", () => {
    const standard = COMPANION_REGISTRY.filter((a) => a.role === "standard").map((a) => a.name);
    expect(standard).toHaveLength(19 - 4 - 2); // total - fast(4) - deep(2)
    for (const name of CACHED_ACTION_NAMES) expect(standard).toContain(name);
  });

  it("cached actions are not exposed as Plus actions and vice versa", () => {
    const overlap = PLUS_ACTION_NAMES.filter((n) => CACHED_ACTION_NAMES.includes(n));
    expect(overlap).toEqual([]);
  });
});

describe("buildContext / systemPrompt per action", () => {
  it("every action produces non-empty context and system prompt against a full fixture", () => {
    for (const action of COMPANION_REGISTRY) {
      const ctx = fixtureContext({ action: action.name });
      const system = action.systemPrompt(ctx);
      const { userContent } = action.buildContext(ctx);
      expect(system.trim().length).toBeGreaterThan(0);
      expect(userContent.trim().length).toBeGreaterThan(0);
    }
  });

  it("selection-only actions throw a clear error when no selection is present", () => {
    const wordLookup = getCompanionAction("word_lookup");
    const ctx = fixtureContext({ action: "word_lookup", selection: null });
    expect(() => wordLookup?.buildContext(ctx)).toThrow(/requires a text selection/);
  });

  it("chat falls back to a generic opener when the user sends no message", () => {
    const chat = getCompanionAction("chat");
    const ctx = fixtureContext({ action: "chat", message: null });
    const { userContent } = chat?.buildContext(ctx) ?? { userContent: "" };
    expect(userContent.length).toBeGreaterThan(0);
  });

  it("bilingual_paragraph's system prompt names the target language", () => {
    const action = getCompanionAction("bilingual_paragraph");
    const ctx = fixtureContext({ action: "bilingual_paragraph", targetLanguage: "French" });
    expect(action?.systemPrompt(ctx)).toContain("French");
  });
});

describe("model-role resolution and cost estimation", () => {
  it("resolves every role to the pinned model id, never a family alias", () => {
    expect(resolveModel("fast")).toBe("claude-haiku-4-5-20251001");
    expect(resolveModel("standard")).toBe("claude-sonnet-5");
    expect(resolveModel("deep")).toBe("claude-opus-4-8");
    for (const model of Object.values(MODELS)) {
      expect(model).not.toMatch(/^(sonnet|opus|haiku)$/);
    }
  });

  it("estimates deep-role calls as meaningfully more expensive than fast-role calls", () => {
    // Realistic per-call token sizes (see the Phase 4a cost estimate): a fast call is
    // short (word_lookup-sized); a deep call carries much more context and output. A
    // single deep call should already approach the whole daily cost ceiling, while a
    // fast call is a small fraction of it -- proving cost, not count, is what matters.
    const fastCost = estimateCostCents("fast", 600, 200);
    const deepCost = estimateCostCents("deep", 4000, 1200);
    expect(deepCost).toBeGreaterThanOrEqual(fastCost * 5);
    expect(deepCost).toBeGreaterThanOrEqual(5);
  });

  it("caps output tokens per role, deep higher than fast", () => {
    expect(MAX_OUTPUT_TOKENS.deep).toBeGreaterThan(MAX_OUTPUT_TOKENS.fast);
  });
});
