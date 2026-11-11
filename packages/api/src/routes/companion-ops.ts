// Minimal admin surface for the companion cache pipeline: an on-demand trigger to run
// a small batch NOW (proving cost, not waiting for the daily cron), gated on the
// admin list (ADMIN_EMAIL and CO_OWNER_EMAILS, core isAdminAccount, applied by profileMw) like /admin/*.
import { Hono } from "hono";
import { companion } from "@foxing/core";
import { errors } from "../error";
import { readBody, requireSession } from "../http";
import type { Env } from "../types";

export const companionOpsRoutes = new Hono<Env>();

// Capped low: this runs synchronously in one HTTP request/response, unlike the
// production Cron+Queue pipeline (which chunks into small per-message batches and has
// no such limit). This route exists for a fast, visible proof run, not the full
// catalog sweep -- use the Cron/Queue path for anything larger than a few books.
const MAX_BATCH = 20;

companionOpsRoutes.post("/ops/companion-cache-batch", async (c) => {
  requireSession(c);
  const profile = c.get("profile");
  if (!profile?.isAdmin) throw errors.forbidden("Admin only.");

  // An empty body takes the default; a body that is not JSON is refused before any paid call, instead of
  // running the default five-book batch.
  const text = await readBody(c);
  let body: { limit?: unknown } = {};
  if (text.trim()) {
    try {
      body = JSON.parse(text) as { limit?: unknown };
    } catch {
      throw errors.validation([{ path: "", message: "Expected a JSON body." }]);
    }
  }
  const limit = Math.min(MAX_BATCH, Math.max(1, Number(body?.limit) || 5));

  const streamCompanion = c.get("streamCompanion");
  const { results, failures } = await companion.runCacheBatch(c.get("db"), streamCompanion, limit);

  const totalCostCents = results.reduce((sum, r) => sum + r.costCents, 0);
  return c.json({
    booksProcessed: new Set(results.map((r) => r.bookId)).size,
    actionsGenerated: results.length,
    totalCostCents,
    results,
    failures,
  });
});
