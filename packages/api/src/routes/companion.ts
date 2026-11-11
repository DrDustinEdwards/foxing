// The AI companion endpoint. Server assembles ALL context; the client
// sends only { action, bookId, threadId?, message?, selection?, chapter?, targetLanguage? }
// and never a prompt or system prompt -- this is what the D10 adversarial eval
// checks. Tier-gated (D11 Plus actions) and quota-gated (cost-based, not request-
// count, security-open-items.md item 4). Streams via SSE.
import { logEvent } from "@dustinedwards/site-runtime/log";
import { checkProse } from "@dustinedwards/site-runtime/prose";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { catalogRepo, companion, companionInput, companionRepo } from "@foxing/core";
import { errors } from "../error";
import { parseJson, requireSession } from "../http";
import { rateLimit } from "../middleware/rate-limit";
import type { Env } from "../types";

export const companionRoutes = new Hono<Env>();

companionRoutes.post("/companion", rateLimit("companion"), async (c) => {
  const session = requireSession(c);
  const profile = c.get("profile");
  const input = await parseJson(c, companionInput);

  const action = companion.getCompanionAction(input.action);
  if (action?.tier !== "plus") throw errors.notFound("Unknown action.");
  if (profile?.subscriptionTier !== "plus") throw errors.planRequired();

  const db = c.get("db");

  const book = await catalogRepo.getBookById(db, input.bookId);
  if (!book) throw errors.notFound("Book not found.");

  const thread = input.threadId
    ? await companionRepo.getThreadById(db, input.threadId)
    : await companionRepo.getOrCreateThread(db, session.id, input.bookId, input.action);
  if (!thread || thread.userId !== session.id) throw errors.notFound("Thread not found.");

  const cachedDescription = await companionRepo.getCachedAction(
    db,
    input.bookId,
    "book_description",
  );
  const recent = await companionRepo.listRecentMessages(db, thread.id, 10);

  const ctx = {
    action: input.action,
    book: {
      id: book.id,
      title: book.title,
      author: book.author,
      description:
        (typeof cachedDescription?.content === "string" ? cachedDescription.content : null) ??
        book.description,
      publicationYear: book.publicationYear,
      subjects: book.subjects,
    },
    selection: input.selection ?? null,
    chapter: input.selection?.chapter ?? input.chapter ?? null,
    message: input.message ?? null,
    targetLanguage: input.targetLanguage ?? null,
    history: recent.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  };

  const { userContent } = action.buildContext(ctx);
  const model = companion.resolveModel(action.role);
  const system = action.systemPrompt(ctx);
  const maxTokens = companion.MAX_OUTPUT_TOKENS[action.role];

  // Quota: reserve this call's worst case before the model is called, in one statement that also checks the cap, so
  // parallel requests cannot all pass on the same count. It is settled to the real cost once the reply is whole; a
  // reply that fails or is canceled keeps the reservation, since the model may have been billed for it.
  const inputChars =
    system.length + userContent.length + ctx.history.reduce((n, m) => n + m.content.length, 0);
  const reserved = companion.reserveCents(action.role, inputChars, maxTokens);
  const quotaDay = await companionRepo.reserveUsage(db, session.id, reserved);
  if (!quotaDay) throw errors.quotaExceeded(companion.quotaResetsAt());

  if (input.message) {
    await companionRepo.appendMessage(db, thread.id, "user", input.message, input.action);
  }

  const streamCompanion = c.get("streamCompanion");

  return streamSSE(c, async (stream) => {
    let assistantText = "";
    let usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

    try {
      for await (const event of streamCompanion({
        model,
        system,
        messages: [...ctx.history, { role: "user", content: userContent }],
        maxTokens,
        feature: `companion:${input.action}`,
        // The system prompt and the thread so far are the same on the next turn: cache them (C7).
        cache: true,
      })) {
        if (event.type === "text") {
          assistantText += event.delta;
          await stream.writeSSE({ event: "delta", data: event.delta });
        } else {
          usage = event.usage;
        }
      }
    } catch (err) {
      await stream.writeSSE({
        event: "error",
        data: "The companion could not complete that request.",
      });
      logEvent(
        "companion_stream_failed",
        // No reader id in the log (S5); the action and the failure kind are enough to act on.
        { action: input.action, error: err },
        { level: "error" },
      );
      return;
    }

    // The reply is whole: its real cost replaces the reservation.
    const costCents = companion.estimateCostCents(action.role, usage);
    await companionRepo.settleUsage(db, session.id, quotaDay, reserved, costCents);

    // The prose check (W1). The reply streams, so this runs once it is whole: it records which checks a
    // reply tripped (never the text or the reader) for the flagged replies to be counted and acted on.
    const flagged = checkProse(assistantText).filter(
      (i) => i.severity === "high" || i.severity === "critical",
    );
    if (flagged.length) {
      logEvent(
        "companion_prose_flagged",
        { action: input.action, checks: flagged.map((i) => i.check) },
        { level: "warn" },
      );
    }

    await companionRepo.appendMessage(db, thread.id, "assistant", assistantText, input.action);

    await stream.writeSSE({ event: "done", data: JSON.stringify({ threadId: thread.id }) });
  });
});
