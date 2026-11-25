// Generates the 4 free-cached catalog actions for one book into book_ai_cache; one code path for the Queue consumer and the manual
// one-off script. These texts are public catalog pages, so a reply that did not finish or trips a high prose finding (refusal, cutoff
// note, blank, chatbot markup, blurb tell) is never written: generation throws and the queue retries.
import { checkProse, OUT_OF_PLACE } from "@dustinedwards/site-runtime/prose";
import type { Usage } from "@dustinedwards/site-runtime/anthropic";
import type { Db } from "../db";
import * as catalogBooksRepo from "../repositories/catalog/books";
import * as companionRepo from "../repositories/companion";
import type { CompanionCaller } from "./client";
import { emptyUsage } from "./models";
import { estimateCostCents, MAX_OUTPUT_TOKENS, resolveModel } from "./models";
import {
  CACHED_ACTION_NAMES,
  type CompanionBookContext,
  type CompanionContext,
  getCompanionAction,
} from "./registry";

import { errorMessage } from "@dustinedwards/site-runtime/log";
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
): Promise<{ text: string; usage: Usage }> {
  let text = "";
  let usage = emptyUsage();
  for await (const event of caller(args)) {
    if (event.type === "text") text += event.delta;
    else usage = event.usage;
  }
  return { text, usage };
}

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
    const { text, usage } = await collectText(caller, {
      model,
      system: def.systemPrompt(ctx),
      messages: [{ role: "user", content: def.buildContext(ctx).userContent }],
      maxTokens: MAX_OUTPUT_TOKENS[def.role],
      feature: "catalog-cache",
    });

    // A word on the stock list that is part of the book's own title or author ("Lyrical Ballads", "His
    // Masterpiece") is a name, not a habit: the reply must be free to say it.
    const own = `${book.title} ${book.author}`.toLowerCase();
    const allow = OUT_OF_PLACE.filter((w) => own.includes(w));
    const findings = checkProse(text, { allow }).filter(
      (i) => i.severity === "high" || i.severity === "critical",
    );
    if (findings.length) {
      throw new Error(
        `${name} for ${book.id} failed the prose check: ${findings.map((i) => i.check).join(", ")}`,
      );
    }
    await companionRepo.upsertCachedAction(db, book.id, name, text, model);
    results.push({
      bookId: book.id,
      action: name,
      outputChars: text.length,
      inputTokens: usage.input + usage.cacheRead + usage.cacheWrite + usage.cacheWrite1h,
      outputTokens: usage.output,
      costCents: estimateCostCents(def.role, usage),
    });
  }

  return results;
}

export async function runCacheBatch(
  db: Db,
  caller: CompanionCaller,
  limit: number,
): Promise<{ results: CacheGenerationResult[]; failures: { bookId: string; error: string }[] }> {
  const books = await catalogBooksRepo.findBooksNeedingCache(db, CACHED_ACTION_NAMES, limit);
  const results: CacheGenerationResult[] = [];
  const failures: { bookId: string; error: string }[] = [];
  for (const book of books) {
    const ctx: CompanionBookContext = {
      id: book.id,
      title: book.title,
      author: book.author,
      description: book.description,
      publicationYear: book.publicationYear,
      subjects: book.subjects,
    };
    // One book that fails (a prose finding, a model error) is recorded and skipped, so it no longer stops every
    // book behind it on every run. The others' rows are written; the failed one is picked again next run.
    try {
      results.push(...(await generateCachedActionsForBook(db, caller, ctx)));
    } catch (err) {
      failures.push({ bookId: book.id, error: errorMessage(err) });
    }
  }
  if (failures.length && failures.length === books.length) {
    throw new Error(`every book in the batch failed: ${failures.map((f) => f.error).join("; ")}`);
  }
  return { results, failures };
}
