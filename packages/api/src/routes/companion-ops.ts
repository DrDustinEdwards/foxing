// Minimal admin surface for the companion cache pipeline: an on-demand trigger to run
// a small batch NOW (proving cost, not waiting for the daily cron), gated on
// profiles.is_admin (the same flag the future /ops/mcp surface will use -- this
// route should migrate there once Phase 8 builds it; a narrow interim is fine now).
import { Hono } from "hono";
import { companion } from "@foxing/core";
import { errors } from "../error";
import { requireSession } from "../http";
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

  const body = await c.req.json().catch(() => ({}));
  const limit = Math.min(MAX_BATCH, Math.max(1, Number(body?.limit) || 5));

  const streamCompanion = c.get("streamCompanion");
  const results = await companion.runCacheBatch(c.get("db"), streamCompanion, limit);

  const totalCostCents = results.reduce((sum, r) => sum + r.costCents, 0);
  return c.json({
    booksProcessed: new Set(results.map((r) => r.bookId)).size,
    actionsGenerated: results.length,
    totalCostCents,
    results,
  });
});
