// Find next book: resolve the tiered recommender's injected deps from env and call core.
// Reads run in-process via core (the standing rule: loaders never self-fetch /api/v1).
// The AI tier is Plus + key gated inside core; here we only wire the caller (null when
// ANTHROPIC_API_KEY is unset) and KV. The Want-to-read write goes to /api/v1 from the
// browser, not here.
import { companion, createDb, getRecommendations } from "@foxing/core";
import type { RecommendationSet } from "@foxing/core";

export async function loadRecommendations(
  env: Env,
  userId: string,
  opts: { refresh?: boolean } = {},
): Promise<RecommendationSet> {
  const db = createDb(env.DB);
  const caller = env.ANTHROPIC_API_KEY
    ? companion.createAnthropicCaller(env.ANTHROPIC_API_KEY)
    : null;
  return getRecommendations(db, userId, {
    caller,
    kv: env.APP_KV ?? null,
    refresh: opts.refresh,
  });
}
