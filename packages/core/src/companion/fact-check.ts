// Fact-checks the cached AI texts of one book against the web and corrects them in place. Called from the Queue
// consumer, one book per message. The checker is injected (a Messages call with the web search tool, built in
// apps/web/app/lib/anthropic.server.ts), so a test supplies a stub with no network call and no key.
//
// Nothing wrong stays on the page: a text the model corrects is replaced by the corrected text (the original is kept
// in book_ai_review), and a corrected text that fails the prose check is blanked, which the page skips like any empty
// text. A call that did not finish throws and writes nothing, so the queue retries the book.
import { checkProse, OUT_OF_PLACE, WRITING_RULES } from "@dustinedwards/site-runtime/prose";
import { UNTRUSTED_DATA_RULE, untrusted } from "@dustinedwards/site-runtime/anthropic";
import { costMicros } from "@dustinedwards/site-runtime/ai-engine";
import type { Db } from "../db";
import * as companionRepo from "../repositories/companion";
import type { FactChecker } from "./client";
import { resolveModel } from "./models";
import { CACHED_ACTION_NAMES } from "./registry";

/** Anthropic's web search price, $10 per 1,000 searches (docs: agents-and-tools/tool-use/web-search-tool). */
const SEARCH_MICROS = 10_000;

export const FACT_CHECK_SYSTEM = `You fact-check the texts a reading site shows on one public-domain book's page. Use web search, preferring Wikipedia, Project Gutenberg, Standard Ebooks, ISFDB, Britannica, the Library of Congress and the Internet Archive, and check every claim a reader could verify: plot events and who did what, character and place names, dates, series order and number, the author's life and career, other books named as related, and whether a "similar book" really is what the text says it is.

Per text, answer "ok" when every claim holds, or "fixed" with a full corrected text. A corrected text keeps the same format, voice and rough length, corrects each wrong claim from a source you found, and removes any claim you could not verify instead of keeping it. Never add a fact you did not find in a source. Remove leaked instructions or reasoning ("or really any...", notes to the editor). ${WRITING_RULES}

${UNTRUSTED_DATA_RULE}

End with one JSON object in a \`\`\`json fence and nothing after it:
{"texts": {"<action>": {"verdict": "ok" | "fixed", "issues": ["what was wrong, short"], "corrected": "full corrected text, only when fixed"}}, "sources": ["https://..."]}
Include every action you were given and no other.`;

export type FactCheckBook = {
  id: string;
  title: string;
  author: string;
  description: string | null;
};

type Verdict = { verdict: "ok" | "fixed"; issues: string[]; corrected?: string };

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

/** The JSON object in the reply's last json fence (or the whole reply), validated; null when it does not fit. */
export function parseFactCheck(
  text: string,
): { texts: Record<string, Verdict>; sources: string[] } | null {
  const fences = [...text.matchAll(/```json\s*([\s\S]*?)```/g)];
  const raw = fences.length ? fences[fences.length - 1][1] : text.slice(text.indexOf("{"));
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  const body = value as { texts?: Record<string, Record<string, unknown>>; sources?: unknown };
  if (!body || typeof body.texts !== "object" || body.texts === null) return null;
  const texts: Record<string, Verdict> = {};
  for (const [action, v] of Object.entries(body.texts)) {
    const issues = Array.isArray(v?.issues) ? v.issues.filter((i) => typeof i === "string") : [];
    if (v?.verdict === "ok") texts[action] = { verdict: "ok", issues };
    else if (v?.verdict === "fixed") {
      const corrected = str(v.corrected);
      if (!corrected) return null;
      texts[action] = { verdict: "fixed", issues, corrected };
    } else return null;
  }
  const sources = Array.isArray(body.sources)
    ? body.sources.filter((s): s is string => typeof s === "string").slice(0, 12)
    : [];
  return { texts, sources };
}

export type FactCheckResult = {
  bookId: string;
  checked: number;
  fixed: number;
  withheld: number;
  searches: number;
  costMicros: number;
};

/** Check every non-empty cached text of one book, correcting what is wrong. Returns null when it had none. */
export async function factCheckBook(
  db: Db,
  check: FactChecker,
  book: FactCheckBook,
): Promise<FactCheckResult | null> {
  const cached = (await companionRepo.listCachedActions(db, book.id)).filter(
    (row) =>
      typeof row.content === "string" &&
      row.content.trim() &&
      CACHED_ACTION_NAMES.includes(row.action),
  );
  if (!cached.length) return null;

  const model = resolveModel("fast");
  const parts = [`"${book.title}" by ${book.author}`];
  if (book.description) parts.push(untrusted("catalog-description", book.description));
  for (const row of cached) parts.push(untrusted(row.action, row.content as string));
  const reply = await check({ model, system: FACT_CHECK_SYSTEM, user: parts.join("\n\n") });

  const parsed = parseFactCheck(reply.text);
  if (!parsed) throw new Error(`the fact-check reply for ${book.id} was not the expected JSON`);
  const missing = cached.filter((row) => !parsed.texts[row.action]);
  if (missing.length)
    throw new Error(
      `the fact-check reply for ${book.id} left out ${missing.map((r) => r.action).join(", ")}`,
    );

  const cost = Math.ceil((costMicros(model, reply.usage) ?? 0) + reply.searches * SEARCH_MICROS);
  const share = Math.ceil(cost / cached.length);
  const own = `${book.title} ${book.author}`.toLowerCase();
  const allow = OUT_OF_PLACE.filter((w) => own.includes(w));
  const result: FactCheckResult = {
    bookId: book.id,
    checked: cached.length,
    fixed: 0,
    withheld: 0,
    searches: reply.searches,
    costMicros: cost,
  };

  for (const row of cached) {
    const v = parsed.texts[row.action];
    let verdict: "ok" | "fixed" | "withheld" = v.verdict;
    let next: string | null = null;
    if (v.verdict === "fixed") {
      const high = checkProse(v.corrected as string, { allow }).filter(
        (i) => i.severity === "high" || i.severity === "critical",
      );
      // A correction that is itself unfit to show leaves nothing wrong on the page: the text is blanked.
      next = high.length ? "" : (v.corrected as string);
      verdict = high.length ? "withheld" : "fixed";
    }
    await companionRepo.saveFactCheck(db, {
      bookId: book.id,
      action: row.action,
      verdict,
      issues: v.issues,
      original: next === null ? null : row.content,
      next,
      sources: parsed.sources,
      searches: reply.searches,
      costMicros: share,
      model,
    });
    if (verdict === "fixed") result.fixed++;
    if (verdict === "withheld") result.withheld++;
  }
  return result;
}
