// Single pinned place for every model id the companion calls. Every action in the
// registry references a ROLE (fast|standard|deep), never a raw model id, so a model
// change never needs to touch more than this file.
//
// To change a model: edit here, then RE-RUN THE D10 ADVERSARIAL EVAL (node --experimental-strip-types packages/core/eval/companion-eval.mjs). Never use
// auto-resolving family aliases ("sonnet", "opus", "haiku") -- this is a paid,
// quota-bounded, safety-evaluated path and a silent model swap breaks cost math and
// invalidates the eval.
export const MODELS = {
  fast: "claude-haiku-5-5", // cheap, high-frequency (word_lookup, word_aspect, ...)
  standard: "claude-sonnet-5", // default. Sonnet 4.6 is LEGACY -- do not use it.
  deep: "claude-opus-5-5", // heavy reasoning (deep_dive, reading_personality)
} as const;

export type CompanionRole = keyof typeof MODELS;

export function resolveModel(role: CompanionRole): string {
  return MODELS[role];
}

// Per-million-token USD rates for the pinned models above (checked against
// platform.claude.com/docs/en/about-claude/pricing on 2026-11-05). Update alongside
// MODELS whenever a pinned model changes -- quota math is meaningless against a stale
// rate.
const RATES_PER_MTOK: Record<CompanionRole, { input: number; output: number }> = {
  fast: { input: 0.1, output: 0.5 }, // Haiku 5.5 (prompts up to 100,000 tokens; $0.50/$2.50 above that)
  standard: { input: 2, output: 10 }, // Sonnet 5 (standard price since Anthropic dropped the planned September 2026 increase)
  deep: { input: 4, output: 20 }, // Opus 5.5
};

/** Estimated cost of one call, in whole cents (rounded up so quota math never undercounts). */
export function estimateCostCents(
  role: CompanionRole,
  inputTokens: number,
  outputTokens: number,
): number {
  const rate = RATES_PER_MTOK[role];
  const dollars = (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000;
  return Math.ceil(dollars * 100);
}

/** Per-role output cap, so a single call cannot itself blow past the daily ceiling. */
export const MAX_OUTPUT_TOKENS: Record<CompanionRole, number> = {
  fast: 400,
  standard: 1200,
  deep: 3000,
};
