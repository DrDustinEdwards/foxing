// Find next book: resolve the tiered recommender's injected deps from env and call core.
// Reads run in-process via core (the standing rule: loaders never self-fetch /api/v1).
// The AI tier is Plus + key gated inside core; here we only wire the caller (null when
// ANTHROPIC_API_KEY is unset) and KV. The Want-to-read write goes to /api/v1 from the
// browser, not here.
import { createDb, getRecommendations } from "@foxing/core";
import type { RecommendationSet } from "@foxing/core";
import { anthropicCaller } from "./anthropic.server";

export async function loadRecommendations(
  env: Env,
  userId: string,
  opts: { refresh?: boolean } = {},
): Promise<RecommendationSet> {
  const db = createDb(env.DB);
  const caller = anthropicCaller(env);
  return getRecommendations(db, userId, {
    caller,
    kv: env.APP_KV ?? null,
    refresh: opts.refresh,
  });
}
