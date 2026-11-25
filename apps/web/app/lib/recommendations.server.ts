import { createDb, getRecommendations } from "@foxing/core";
import type { RecommendationSet } from "@foxing/core";
import { anthropicStructured } from "./anthropic.server";

export async function loadRecommendations(
  env: Env,
  userId: string,
  opts: { refresh?: boolean } = {},
): Promise<RecommendationSet> {
  const db = createDb(env.DB);
  return getRecommendations(db, userId, {
    caller: anthropicStructured(env),
    kv: env.APP_KV ?? null,
    refresh: opts.refresh,
  });
}
