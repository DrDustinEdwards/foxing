import { describe, expect, it } from "vitest";
import {
  CACHED_ACTION_NAMES,
  COMPANION_REGISTRY,
  type CompanionContext,
  getCompanionAction,
  PLUS_ACTION_NAMES,
} from "../src/companion/registry";
import { estimateCostCents, MODELS } from "../src/companion/models";

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
});

describe("model-role resolution", () => {
  it("resolves every role to a pinned model id, never a family alias", () => {
    for (const model of Object.values(MODELS)) {
      expect(model).not.toMatch(/^(sonnet|opus|haiku)$/);
    }
  });
});

describe("call cost", () => {
  it("prices cache reads and writes, which a cached companion turn is mostly made of", () => {
    const uncached = estimateCostCents("standard", {
      input: 100,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      cacheWrite1h: 0,
    });
    const cached = estimateCostCents("standard", {
      input: 100,
      output: 0,
      cacheRead: 200_000,
      cacheWrite: 50_000,
      cacheWrite1h: 0,
    });
    // Sonnet 5.5: 100 x $2 + 200,000 reads x $0.10 + 50,000 writes x $2.50 per million = $0.1452, rounded up.
    expect(uncached).toBe(1);
    expect(cached).toBe(15);
  });
});
