import {
  catalogHealthDomain,
  catalogRepo,
  companion,
  companionRepo,
  createDb,
  push,
} from "@foxing/core";
import { logEvent } from "@dustinedwards/site-runtime/log";
import { anthropicCaller, anthropicFactChecker } from "../app/lib/anthropic.server";

export type CacheJobMessage = { bookId: string; factCheck?: true };

// Push sweep: kept off the notification write path so core stays binding-free.
const PUSH_SWEEP_LOOKBACK_MS = 10 * 60 * 1000;

export async function runPushSweep(env: Env): Promise<void> {
  const db = createDb(env.DB);
  const kv = env.APP_KV;
  const now = Date.now();
  const lastRaw = await kv.get("push:last_sweep");
  const since = lastRaw ? Number(lastRaw) : now - PUSH_SWEEP_LOOKBACK_MS;
  await push.sweepPushDeliveries(db, { fetchImpl: fetch, nowUtcMs: now, kv }, since);
  // Only a finished sweep moves the cursor: a thrown one retries from the same point.
  await kv.put("push:last_sweep", String(now));
}

const CACHE_LAST_BATCH_KEY = "companion-cache:last-batch";

// A consumer whose model calls all fail would leave this job "ok" and /health green, so books come back
// oldest-updated first: a batch still uncached on the next run means nothing was written, and the job fails.
export async function enqueueCompanionCache(env: Env): Promise<void> {
  const db = createDb(env.DB);
  const limit = Number(env.COMPANION_CACHE_BATCH_SIZE) || 200;
  const books = await catalogRepo.findBooksNeedingCache(db, companion.CACHED_ACTION_NAMES, limit);
  const ids = books.map((book) => book.id);
  const last = ((await env.APP_KV.get(CACHE_LAST_BATCH_KEY, "json")) as string[] | null) ?? [];
  const stalled = last.length > 0 && last.every((id) => ids.includes(id));
  await env.APP_KV.put(CACHE_LAST_BATCH_KEY, JSON.stringify(ids));
  await Promise.all(
    books.map((book) =>
      env.COMPANION_CACHE_QUEUE.send({ bookId: book.id } satisfies CacheJobMessage),
    ),
  );
  if (stalled)
    throw new Error(
      `the last batch of ${last.length} books is still uncached: the model calls are failing (see companion_cache_failed and anthropic_call in the logs)`,
    );
}

// Daily; while KV `companion-fact-check:only` holds a JSON array of book ids only those are checked (delete it to sweep).
// A run inside FACT_CHECK_HOLD_SECONDS of the last does nothing: the queue is slow and would double-bill the same books.
const FACT_CHECK_BATCH = 1500;
const FACT_CHECK_ONLY_KEY = "companion-fact-check:only";
const FACT_CHECK_HOLD_KEY = "companion-fact-check:enqueued";
const FACT_CHECK_HOLD_SECONDS = 20 * 60 * 60;
export async function enqueueFactCheck(env: Env): Promise<void> {
  if (await env.APP_KV.get(FACT_CHECK_HOLD_KEY)) return;
  const db = createDb(env.DB);
  const only = (await env.APP_KV.get(FACT_CHECK_ONLY_KEY, "json")) as string[] | null;
  const books = await companionRepo.findBooksNeedingFactCheck(
    db,
    FACT_CHECK_BATCH,
    only ?? undefined,
  );
  await Promise.all(
    books.map((book) =>
      env.COMPANION_CACHE_QUEUE.send({
        bookId: book.id,
        factCheck: true,
      } satisfies CacheJobMessage),
    ),
  );
  if (books.length)
    await env.APP_KV.put(FACT_CHECK_HOLD_KEY, new Date().toISOString(), {
      expirationTtl: FACT_CHECK_HOLD_SECONDS,
    });
}

async function factCheckMessage(
  db: ReturnType<typeof createDb>,
  checker: companion.FactChecker | null,
  message: Message<CacheJobMessage>,
): Promise<void> {
  if (!checker) return message.retry();
  try {
    const book = await catalogRepo.getBookById(db, message.body.bookId);
    const result = book && (await companion.factCheckBook(db, checker, book));
    if (result) logEvent("companion_fact_checked", { ...result });
    message.ack();
  } catch (err) {
    const limited = err instanceof Error && err.message.includes("(rate_limited)");
    logEvent(
      "companion_fact_check_failed",
      {
        book_id: message.body.bookId,
        error: err,
        reply_tail: (err as { replyTail?: string }).replyTail,
      },
      { level: limited ? "warn" : "error" },
    );
    // Every attempt is billed, so a failing book is given up after three; a reply cut off at max_tokens recurs.
    const cutOff = err instanceof Error && err.message.includes("(truncated)");
    if (cutOff || message.attempts >= 3) return message.ack();
    message.retry({ delaySeconds: 60 * message.attempts });
  }
}

export async function queue(
  batch: MessageBatch<CacheJobMessage>,
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  const db = createDb(env.DB);
  const caller = anthropicCaller(env);
  const checker = anthropicFactChecker(env);

  for (const message of batch.messages) {
    if (message.body.factCheck) {
      await factCheckMessage(db, checker, message);
      continue;
    }
    if (!caller) {
      message.retry();
      continue;
    }
    try {
      const book = await catalogRepo.getBookById(db, message.body.bookId);
      if (!book) {
        message.ack(); // the book no longer exists; nothing to retry
        continue;
      }
      await companion.generateCachedActionsForBook(db, caller, {
        id: book.id,
        title: book.title,
        author: book.author,
        // Template filler would only teach the model a line that describes nothing.
        description: catalogHealthDomain.isTemplateDescription(book.description)
          ? null
          : book.description,
        publicationYear: book.publicationYear,
        subjects: book.subjects,
      });
      message.ack();
    } catch (err) {
      // A rate limit is the queue outrunning the quota, not a fault: warn and retry later (a minute longer each attempt).
      const limited = err instanceof Error && err.message.includes("(rate_limited)");
      logEvent(
        "companion_cache_failed",
        { book_id: message.body.bookId, error: err },
        { level: limited ? "warn" : "error" },
      );
      // A billed failed reply or prose-check failure recurs, so give up after three; the next daily run picks it up.
      if (limited) message.retry({ delaySeconds: 60 * message.attempts });
      else if (message.attempts >= 3) message.ack();
      else message.retry();
    }
  }
}
