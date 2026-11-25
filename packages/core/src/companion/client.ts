// The companion's model calls as function types only (dependency-injected), so tests substitute a stub with no network or key.
// The Worker builds the real ones on site-runtime's Anthropic caller.
import type { Usage } from "@dustinedwards/site-runtime/anthropic";

export type CompanionMessage = { role: "user" | "assistant"; content: string };

export type CompanionStreamEvent = { type: "text"; delta: string } | { type: "done"; usage: Usage };

export type CompanionCallArgs = {
  model: string;
  system: string;
  messages: CompanionMessage[];
  maxTokens: number;
  feature?: string;
  /** Prompt caching: true caches the prompt up to its last message for a conversation whose next turn repeats it; unset caches only a system prompt long enough alone. */
  cache?: boolean;
};

/** A streamed reply: text deltas, then one `done`. Throws when the reply did not finish, so nothing stores or caches cut-off text as complete. */
export type CompanionCaller = (args: CompanionCallArgs) => AsyncIterable<CompanionStreamEvent>;

export type StructuredCaller = (
  args: CompanionCallArgs,
  schema: Record<string, unknown>,
) => Promise<{ value: unknown; usage: Usage }>;

export type FactChecker = (args: { model: string; system: string; user: string }) => Promise<{
  text: string;
  usage: Usage;
  searches: number;
}>;
