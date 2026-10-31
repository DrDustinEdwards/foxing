// The companion's model calls, as types only. The API route and the domain code depend on
// these function types (dependency-injected, same pattern as ApiDeps.resolveSession), so
// tests substitute a stub with no network call and no key. The Worker builds the real ones
// on site-runtime's Anthropic caller (apps/web/app/lib/anthropic.server.ts).

export type CompanionMessage = { role: "user" | "assistant"; content: string };

export type CompanionStreamEvent =
  | { type: "text"; delta: string }
  | { type: "done"; inputTokens: number; outputTokens: number };

export type CompanionCallArgs = {
  model: string;
  system: string;
  messages: CompanionMessage[];
  maxTokens: number;
  /** What is calling, for the call's log line ("companion:chat", "catalog-cache"). */
  feature?: string;
};

/**
 * A streamed reply: text deltas, then one `done`. Throws when the reply did not finish
 * (cut off, refused, failed), after any deltas already sent, so nothing that catches the
 * throw stores or caches the text as complete.
 */
export type CompanionCaller = (args: CompanionCallArgs) => AsyncIterable<CompanionStreamEvent>;

/** A reply that is JSON matching `schema`, parsed. Throws when the call fails or the JSON does not parse. */
export type StructuredCaller = (
  args: CompanionCallArgs,
  schema: Record<string, unknown>,
) => Promise<{ value: unknown; inputTokens: number; outputTokens: number }>;
