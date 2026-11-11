// Every model id the companion calls, by ROLE (fast|standard|deep): site-runtime's MODEL_IDS, the network's one
// registry, so a model change is made there once and reaches every site. The registry never holds a family alias
// ("sonnet", "opus", "haiku"): this is a paid, quota-bounded, safety-evaluated path, and a silent model swap breaks the
// cost math and invalidates the eval. When site-runtime changes a pinned model, RE-RUN THE D10 ADVERSARIAL EVAL (node
// --experimental-strip-types packages/core/eval/companion-eval.mjs).
import { costMicros } from "@dustinedwards/site-runtime/ai-engine";
import { MODEL_IDS, type Usage } from "@dustinedwards/site-runtime/anthropic";

export const MODELS = MODEL_IDS;

export type CompanionRole = keyof typeof MODELS;

export function resolveModel(role: CompanionRole): string {
  return MODELS[role];
}

/**
 * Estimated cost of one call, in whole cents, rounded up so quota math never undercounts. Priced by site-runtime's
 * PRICES (the network's one table), cache reads and writes included: the companion caches its prompt.
 */
export function estimateCostCents(role: CompanionRole, usage: Usage): number {
  const micros = costMicros(MODELS[role], usage);
  if (micros === null) throw new Error(`no listed price for ${MODELS[role]}`);
  return Math.ceil(micros / 10_000);
}

/** Per-role output cap, so a single call cannot itself blow past the daily ceiling. */
export const MAX_OUTPUT_TOKENS: Record<CompanionRole, number> = {
  fast: 400,
  standard: 1200,
  deep: 3000,
};
