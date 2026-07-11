// Generates the 4 free-cached catalog actions for one book and writes them to
// book_ai_cache. Called from both the Queue consumer (production) and a manual
// one-off script (proving cost on a small batch) -- one code path, not two.
import type { Db } from "../db";
import * as catalogBooksRepo from "../repositories/catalog/books";
import * as companionRepo from "../repositories/companion";
import type { CompanionCaller } from "./client";
import { estimateCostCents, MAX_OUTPUT_TOKENS, resolveModel } from "./models";
import {
  CACHED_ACTION_NAMES,
  type CompanionBookContext,
  type CompanionContext,
  getCompanionAction,
} from "./registry";

export type CacheGenerationResult = {
  bookId: string;
  action: string;
  outputChars: number;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
};

async function collectText(
  caller: CompanionCaller,
  args: Parameters<CompanionCaller>[0],
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  let text = "";
  let inputTokens = 0;
  let outputTokens = 0;
  for await (const event of caller(args)) {
    if (event.type === "text") text += event.delta;
    else {
      inputTokens = event.inputTokens;
      outputTokens = event.outputTokens;
    }
  }
  return { text, inputTokens, outputTokens };
}

/** Generate (or regenerate) the given cached actions for one book, writing each row. */
export async function generateCachedActionsForBook(
  db: Db,
  caller: CompanionCaller,
  book: CompanionBookContext,
  actions: readonly string[] = CACHED_ACTION_NAMES,
): Promise<CacheGenerationResult[]> {
  const results: CacheGenerationResult[] = [];

  for (const name of actions) {
    const def = getCompanionAction(name);
    if (def?.tier !== "free-cached") continue;

    const ctx: CompanionContext = { action: name, book, history: [] };
    const model = resolveModel(def.role);
    const { text, inputTokens, outputTokens } = await collectText(caller, {
      model,
      system: def.systemPrompt(ctx),
      messages: [{ role: "user", content: def.buildContext(ctx).userContent }],
      maxTokens: MAX_OUTPUT_TOKENS[def.role],
    });

    await companionRepo.upsertCachedAction(db, book.id, name, text, model);
    results.push({
      bookId: book.id,
      action: name,
      outputChars: text.length,
      inputTokens,
      outputTokens,
      costCents: estimateCostCents(def.role, inputTokens, outputTokens),
    });
  }

  return results;
}

/**
 * Find up to `limit` catalog books still missing a cached action and generate all 4
 * for each. Used by both the Cron-triggered Queue producer path and the manual proof
 * script (scripts/generate-companion-cache.mjs) -- the only two callers, one code path.
 */
export async function runCacheBatch(
  db: Db,
  caller: CompanionCaller,
  limit: number,
): Promise<CacheGenerationResult[]> {
  const books = await catalogBooksRepo.findBooksNeedingCache(db, CACHED_ACTION_NAMES, limit);
  const results: CacheGenerationResult[] = [];
  for (const book of books) {
    const ctx: CompanionBookContext = {
      id: book.id,
      title: book.title,
      author: book.author,
      description: book.description,
      publicationYear: book.publicationYear,
      subjects: book.subjects,
    };
    results.push(...(await generateCachedActionsForBook(db, caller, ctx)));
  }
  return results;
}
