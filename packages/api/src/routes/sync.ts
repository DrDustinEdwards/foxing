// Offline sync endpoints (Phase 7). POST flushes the mobile op queue; GET pulls changed
// single-owner rows since a cursor. Conflict resolution + scoping live entirely in core
// (syncDomain); the route is a thin session-scoped wrapper. Online-only data
// (clubs/social) is never syncable -- the validator's resource enum enforces that.
import { syncDomain, syncPushInput } from "@foxing/core";
import { Hono } from "hono";
import { parseJson, requireSession } from "../http";
import { rateLimit } from "../middleware/rate-limit";
import type { Env } from "../types";

export const syncRoutes = new Hono<Env>();

syncRoutes.post("/sync", rateLimit("write"), async (c) => {
  const session = requireSession(c);
  const { ops } = await parseJson(c, syncPushInput);
  const results = await syncDomain.applySync(c.get("db"), session.id, ops);
  return c.json({ results });
});

syncRoutes.get("/sync", async (c) => {
  const session = requireSession(c);
  const sinceRaw = c.req.query("since");
  const since = sinceRaw ? Number(sinceRaw) : 0;
  const pull = await syncDomain.pullSync(
    c.get("db"),
    session.id,
    Number.isFinite(since) ? since : 0,
  );
  return c.json(pull);
});
