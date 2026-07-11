// The AI companion endpoint (Phase 4a). Server assembles ALL context; the client
// sends only { action, book_id, thread_id?, message?, selection?, target_language? }
// and never a prompt or system prompt -- this is what the D10 adversarial eval
// checks. Tier-gated (D11 Plus actions) and quota-gated (cost-based, not request-
// count, security-open-items.md item 4). Streams via SSE.
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import {
  catalogRepo,
  companion,
  companionInput,
  companionRepo,
  type QuotaState,
} from "@foxing/core";
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
  const kv = c.env.APP_KV;

  // Quota check happens before the call: cost is only known once the call settles,
  // so a request that is rejected here never touches the model.
  const kvKey = companion.quotaKey(session.id);
  const raw = await kv.get(kvKey);
  const state: QuotaState = raw ? (JSON.parse(raw) as QuotaState) : companion.EMPTY_QUOTA_STATE;
  if (companion.isOverQuota(state)) {
    throw errors.quotaExceeded(companion.quotaResetsAt());
  }

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
    chapter: input.selection?.chapter ?? null,
    message: input.message ?? null,
    targetLanguage: input.targetLanguage ?? null,
    history: recent.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  };

  const { userContent } = action.buildContext(ctx);
  const model = companion.resolveModel(action.role);
  const system = action.systemPrompt(ctx);
  const maxTokens = companion.MAX_OUTPUT_TOKENS[action.role];

  if (input.message) {
    await companionRepo.appendMessage(db, thread.id, "user", input.message, input.action);
  }

  const streamCompanion = c.get("streamCompanion");

  return streamSSE(c, async (stream) => {
    let assistantText = "";
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      for await (const event of streamCompanion({
        model,
        system,
        messages: [...ctx.history, { role: "user", content: userContent }],
        maxTokens,
      })) {
        if (event.type === "text") {
          assistantText += event.delta;
          await stream.writeSSE({ event: "delta", data: event.delta });
        } else {
          inputTokens = event.inputTokens;
          outputTokens = event.outputTokens;
        }
      }
    } catch (err) {
      await stream.writeSSE({
        event: "error",
        data: "The companion could not complete that request.",
      });
      console.error(`[companion] stream failed for ${session.id}/${input.action}`, err);
      return;
    }

    await companionRepo.appendMessage(db, thread.id, "assistant", assistantText, input.action);

    const costCents = companion.estimateCostCents(action.role, inputTokens, outputTokens);
    const nextState = companion.addUsage(state, costCents);
    await kv.put(kvKey, JSON.stringify(nextState), { expirationTtl: 60 * 60 * 25 });

    await stream.writeSSE({ event: "done", data: JSON.stringify({ threadId: thread.id }) });
  });
});
