// The companion action registry: the single source of truth for every AI action
// Foxing exposes, on-demand (Plus, gated) or cached-catalog (free, Queue-generated).
// Pure and unit-testable: no DB, no network, no framework import. The API route
// resolves an action here, builds context, and calls the model; nothing else in the
// codebase should hardcode a system prompt or a tier decision for these actions.
//
// Tier list is authoritative from foxing/free-vs-paid.md (D11). Role assignment is
// fixed by the Phase 4a plan: fast = word_lookup, word_aspect, word_wise,
// language_difficulty. deep = deep_dive, reading_personality. standard = every other
// Plus action and all 4 cached generators.
import type { CompanionRole } from "./models";

export type CompanionTier = "plus" | "free-cached";

export type CompanionBookContext = {
  id: string;
  title: string;
  author: string;
  /** Cached book_description when present, else the raw catalog description. */
  description: string | null;
  publicationYear: number | null;
  subjects: string[] | null;
};

export type CompanionThreadMessage = { role: "user" | "assistant"; content: string };

export type CompanionSelection = {
  text: string;
  /** Readium Locator JSON, opaque here -- only used for display, never parsed. */
  locator?: unknown;
  chapter?: string | null;
};

/** Everything an action's prompt is allowed to see. Assembled server-side only. */
export type CompanionContext = {
  action: string;
  book: CompanionBookContext;
  selection?: CompanionSelection | null;
  chapter?: string | null;
  /** The user's current turn (chat-style actions); absent for single-shot actions. */
  message?: string | null;
  targetLanguage?: string | null;
  /** Recent prior messages in the thread, oldest first. */
  history: CompanionThreadMessage[];
};

export type CompanionAction = {
  name: string;
  tier: CompanionTier;
  role: CompanionRole;
  systemPrompt: (ctx: CompanionContext) => string;
  buildContext: (ctx: CompanionContext) => { userContent: string };
};

function bookLine(ctx: CompanionContext): string {
  const year = ctx.book.publicationYear ? ` (${ctx.book.publicationYear})` : "";
  return `"${ctx.book.title}" by ${ctx.book.author}${year}`;
}

function bookBrief(ctx: CompanionContext): string {
  const parts = [bookLine(ctx)];
  if (ctx.book.description) parts.push(ctx.book.description);
  if (ctx.book.subjects?.length) parts.push(`Subjects: ${ctx.book.subjects.join(", ")}`);
  return parts.join("\n");
}

function selectionLine(ctx: CompanionContext): string {
  if (!ctx.selection) return "";
  const chapter = ctx.selection.chapter ?? ctx.chapter;
  return `Selected passage${chapter ? ` (${chapter})` : ""}:\n"${ctx.selection.text}"`;
}

function requireSelection(ctx: CompanionContext): string {
  if (!ctx.selection?.text) {
    throw new Error("This action requires a text selection.");
  }
  return ctx.selection.text;
}

const PLUS_ACTIONS: CompanionAction[] = [
  {
    name: "word_lookup",
    tier: "plus",
    role: "fast",
    systemPrompt: (ctx) =>
      `You define a single word as it is used in "${ctx.book.title}" by ${ctx.book.author}. ` +
      "Give the sense that fits this context first, then the general definition if it differs. " +
      "Two to three sentences. Plain language, no filler.",
    buildContext: (ctx) => ({
      userContent: `Define "${requireSelection(ctx)}" as used here.\n${selectionLine(ctx)}`,
    }),
  },
  {
    name: "passage_analysis",
    tier: "plus",
    role: "standard",
    systemPrompt: (ctx) =>
      `You analyze a passage from ${bookLine(ctx)} for a reader who wants to understand it more ` +
      "deeply: theme, technique, and why it matters to the book as a whole. A few short paragraphs.",
    buildContext: (ctx) => ({
      userContent: `Analyze this passage.\n${selectionLine(ctx)}`,
    }),
  },
  {
    name: "chat",
    tier: "plus",
    role: "standard",
    systemPrompt: (ctx) =>
      `You are a reading companion discussing ${bookLine(ctx)} with a reader. Be specific to the ` +
      "book, avoid spoilers past what the reader has referenced, and keep the tone like a well-read " +
      "friend, not a lecture. Answer first, in prose. Never open with \"Great question\" or by " +
      "reassuring the reader, and ask a follow-up only when you need the answer, never as a sign-off.",
    buildContext: (ctx) => ({
      userContent: ctx.message?.trim() || "What do you make of the book so far?",
    }),
  },
  {
    name: "word_aspect",
    tier: "plus",
    role: "fast",
    systemPrompt: () =>
      "You explain one linguistic aspect of a word: its etymology, an older or unusual sense, or a " +
      "connotation a modern reader might miss. Two to three sentences.",
    buildContext: (ctx) => ({
      userContent: `What is notable about the word "${requireSelection(ctx)}" here?\n${selectionLine(ctx)}`,
    }),
  },
  {
    name: "language_difficulty",
    tier: "plus",
    role: "fast",
    systemPrompt: () =>
      "You assess the reading difficulty of a short passage: vocabulary level, sentence complexity, " +
      "and what might trip up a modern reader. Two to three sentences, no score out of 10.",
    buildContext: (ctx) => ({
      userContent: `Assess the difficulty of this passage.\n${selectionLine(ctx)}`,
    }),
  },
  {
    name: "deep_dive",
    tier: "plus",
    role: "deep",
    systemPrompt: (ctx) =>
      `You write an extended, scholarly close reading of ${bookLine(ctx)}, grounded in the ` +
      "requested passage or chapter: historical context, literary technique, and how it fits the " +
      "book's larger arguments. Several paragraphs; cite the text directly where useful.",
    buildContext: (ctx) => ({
      userContent: ctx.selection
        ? `Go deep on this passage.\n${selectionLine(ctx)}`
        : `Go deep on ${ctx.chapter ?? "the book so far"}.`,
    }),
  },
  {
    name: "semantic_search",
    tier: "plus",
    role: "standard",
    systemPrompt: (ctx) =>
      `You find and describe passages, themes, or moments in ${bookLine(ctx)} connected to a ` +
      "reader's described idea. Point to what they're likely thinking of, in plain terms.",
    buildContext: (ctx) => ({
      userContent: `Find what connects to this in the book: "${ctx.message?.trim() || requireSelection(ctx)}"`,
    }),
  },
  {
    name: "discussion_starter",
    tier: "plus",
    role: "standard",
    systemPrompt: (ctx) =>
      `You write discussion questions for a reading group covering ${bookLine(ctx)}, scoped to what ` +
      "has been read so far. Open-ended, specific to the text, no yes/no questions. A short numbered list.",
    buildContext: (ctx) => ({
      userContent: `Write discussion questions for ${ctx.chapter ?? "the book so far"}.`,
    }),
  },
  {
    name: "word_wise",
    tier: "plus",
    role: "fast",
    systemPrompt: () =>
      "You restate a passage in plainer language for a reader who wants the meaning without the " +
      "period vocabulary or syntax. Keep it short, keep the tone, do not summarize away the detail.",
    buildContext: (ctx) => ({
      userContent: `Restate this passage more plainly.\n${selectionLine(ctx)}`,
    }),
  },
  {
    name: "character_map",
    tier: "plus",
    role: "standard",
    systemPrompt: (ctx) =>
      `You track the characters in ${bookLine(ctx)} as introduced so far and how they relate to ` +
      "each other. A short list: name, one-line description, relationships. Do not reveal anything " +
      "past the point the reader has reached.",
    buildContext: (ctx) => ({
      userContent: `List the characters known as of ${ctx.chapter ?? "this point in the book"}.`,
    }),
  },
  {
    name: "chapter_feature",
    tier: "plus",
    role: "standard",
    systemPrompt: (ctx) =>
      `You write a short feature on one chapter of ${bookLine(ctx)}: what happens, why it matters, ` +
      "and one detail worth noticing on a re-read. A few short paragraphs, no full plot summary of " +
      "the rest of the book.",
    buildContext: (ctx) => ({
      userContent: `Feature ${ctx.chapter ?? "this chapter"}.`,
    }),
  },
  {
    name: "bilingual_paragraph",
    tier: "plus",
    role: "standard",
    systemPrompt: (ctx) =>
      `You translate a passage from ${bookLine(ctx)} into ${ctx.targetLanguage || "the requested language"}, ` +
      "preserving tone and register, and present the original alongside the translation.",
    buildContext: (ctx) => ({
      userContent: `Translate this passage into ${ctx.targetLanguage || "the requested language"}.\n${selectionLine(ctx)}`,
    }),
  },
  {
    name: "recommendations",
    tier: "plus",
    role: "standard",
    systemPrompt: (ctx) =>
      `You recommend books for a reader currently reading ${bookLine(ctx)}, explaining briefly why ` +
      "each fits. Keep the list short (3-5) and specific, not generic bestseller picks.",
    buildContext: (ctx) => ({
      userContent: ctx.message?.trim() || "Recommend books for a reader who likes this one.",
    }),
  },
  {
    name: "reading_personality",
    tier: "plus",
    role: "deep",
    systemPrompt: () =>
      "You describe a reader's reading personality from the pattern of what they've read and how " +
      "they've engaged with it (moods, pacing, what they finish vs. abandon). Warm, specific, a few " +
      "paragraphs, grounded in the actual pattern given, never generic horoscope language.",
    buildContext: (ctx) => ({
      userContent:
        ctx.message?.trim() ||
        `Describe this reader's personality based on their history with ${bookLine(ctx)} and other books.`,
    }),
  },
  {
    name: "book_insight",
    tier: "plus",
    role: "standard",
    systemPrompt: (ctx) =>
      `You offer one focused insight about ${bookLine(ctx)}: a connection, a pattern, or context the ` +
      "reader likely hasn't considered yet. A short paragraph, not a full analysis.",
    buildContext: (ctx) => ({
      userContent: ctx.message?.trim() || `Offer an insight about ${ctx.book.title}.`,
    }),
  },
];

const CACHED_ACTIONS: CompanionAction[] = [
  {
    name: "book_description",
    tier: "free-cached",
    role: "standard",
    systemPrompt: () =>
      "You write a short, accurate back-cover-style description of a public domain classic for a " +
      "catalog page. Two to three sentences, no spoilers past the premise. No blurb adjectives " +
      "(unforgettable, haunting, lyrical, sweeping, poignant, profound, masterpiece), and do not end " +
      "on a verdict about its worth or staying power (\"stays with you\", \"remains one of the most\"): " +
      "end on a fact.",
    buildContext: (ctx) => ({ userContent: `Write a description for ${bookBrief(ctx)}` }),
  },
  {
    name: "author_bio",
    tier: "free-cached",
    role: "standard",
    systemPrompt: () =>
      "You write a short, factual author biography for a catalog page: who they were, when they " +
      "wrote, and why this book matters in their body of work. A short paragraph. Open with what is " +
      "distinctive about how they write, not their dates or birthplace, and do not end on their legacy.",
    buildContext: (ctx) => ({
      userContent: `Write a biography for ${ctx.book.author}, author of ${bookLine(ctx)}.`,
    }),
  },
  {
    name: "similar_books",
    tier: "free-cached",
    role: "standard",
    systemPrompt: () =>
      "You suggest public domain classics similar to the given book, with a one-line reason each. " +
      "A short list, 3-5 titles, no books that are not genuinely comparable.",
    buildContext: (ctx) => ({ userContent: `Suggest books similar to ${bookBrief(ctx)}` }),
  },
  {
    name: "reading_order",
    tier: "free-cached",
    role: "standard",
    systemPrompt: () =>
      "You state the recommended reading order for a book: whether it is part of a series or should " +
      "be read alongside companion works, and why. If it stands alone, say so plainly in one sentence.",
    buildContext: (ctx) => ({
      userContent: `What is the recommended reading order for ${bookLine(ctx)}?`,
    }),
  },
];

// The habits current models still write (Capsid foxing/ai-writing-tells.md, tested 2026-10-25), on every action.
const STYLE =
  "Never use an em dash. No \"not X, it's Y\". A list of three only when there are three real things.";

export const COMPANION_REGISTRY: CompanionAction[] = [...PLUS_ACTIONS, ...CACHED_ACTIONS].map((a) => ({
  ...a,
  systemPrompt: (ctx) => `${a.systemPrompt(ctx)} ${STYLE}`,
}));

const BY_NAME = new Map(COMPANION_REGISTRY.map((a) => [a.name, a]));

export function getCompanionAction(name: string): CompanionAction | undefined {
  return BY_NAME.get(name);
}

/** The 15 D11 on-demand actions exposed at POST /api/v1/companion. */
export const PLUS_ACTION_NAMES: string[] = PLUS_ACTIONS.map((a) => a.name);

/** The 4 free, Queue-generated catalog actions. NOT exposed on the companion endpoint. */
export const CACHED_ACTION_NAMES: string[] = CACHED_ACTIONS.map((a) => a.name);
