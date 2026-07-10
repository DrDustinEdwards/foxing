// Account data rights (spec-cf-api Phase 3): GDPR export and erasure. Thin: guard
// the session, call the core function, return. The heavy lifting (which tables are
// user-owned, delete order) lives in @foxing/core domain/account.
import { Hono } from "hono";
import { deleteAccount, exportAccount } from "@foxing/core";
import { requireSession } from "../http";
import { rateLimit } from "../middleware/rate-limit";
import type { Env } from "../types";

export const accountRoutes = new Hono<Env>();

// GET /account/export - every user-owned table as a downloadable JSON archive.
accountRoutes.get("/account/export", async (c) => {
  const session = requireSession(c);
  const data = await exportAccount(c.get("db"), session.id);
  const body = JSON.stringify(
    { exportedAt: new Date().toISOString(), user: session, data },
    null,
    2,
  );
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="foxing-export-${session.id}.json"`,
    },
  });
});

// DELETE /account - erase the account and all user-owned data, then the auth rows.
accountRoutes.delete("/account", rateLimit("write"), async (c) => {
  const session = requireSession(c);
  await deleteAccount(c.get("db"), session.id);
  return c.body(null, 204);
});
