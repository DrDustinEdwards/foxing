// Single pinned place for every model id the companion calls. Every action in the
// registry references a ROLE (fast|standard|deep), never a raw model id, so a model
// change never needs to touch more than this file.
//
// To change a model: edit here, then RE-RUN THE D10 ADVERSARIAL EVAL. Never use
// auto-resolving family aliases ("sonnet", "opus", "haiku") -- this is a paid,
// quota-bounded, safety-evaluated path and a silent model swap breaks cost math and
// invalidates the eval.
export const MODELS = {
  fast: "claude-haiku-4-5-20251001", // cheap, high-frequency (word_lookup, word_aspect, ...)
  standard: "claude-sonnet-5", // default. Sonnet 4.6 is LEGACY -- do not use it.
  deep: "claude-opus-4-8", // heavy reasoning (deep_dive, reading_personality)
} as const;

export type CompanionRole = keyof typeof MODELS;

export function resolveModel(role: CompanionRole): string {
  return MODELS[role];
}

// Per-million-token USD rates for the pinned models above (checked against
// platform.claude.com/docs/en/about-claude/pricing on 2026-07-10). Update alongside
// MODELS whenever a pinned model changes -- quota math is meaningless against a stale
// rate. Sonnet 5 is introductory pricing through 2026-08-31; revisit after that date.
const RATES_PER_MTOK: Record<CompanionRole, { input: number; output: number }> = {
  fast: { input: 1, output: 5 }, // Haiku 4.5
  standard: { input: 2, output: 10 }, // Sonnet 5 (introductory, through 2026-08-31)
  deep: { input: 5, output: 25 }, // Opus 4.8
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
