import { Hono } from "hono";
import { checkSuccessors, clubsToHandOver, deleteAccountInput, exportAccount } from "@foxing/core";
import { AppError } from "../error";
import { parseOptionalJson, requireSession } from "../http";
import { rateLimit } from "../middleware/rate-limit";
import type { Env } from "../types";

export const accountRoutes = new Hono<Env>();

// Exporting and deleting need a sign-in from the last 10 minutes; the settings page offers one.
const notFresh = (what: string) =>
  new AppError(
    403,
    "SESSION_NOT_FRESH",
    `To ${what}, sign in again first: it needs a sign-in from the last 10 minutes.`,
  );

accountRoutes.get("/account/export", async (c) => {
  const session = requireSession(c);
  if (!(await c.get("isFresh")(c.req.raw, c.env))) throw notFresh("download your data");
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

accountRoutes.get("/account/clubs", async (c) => {
  const session = requireSession(c);
  return c.json({ clubs: await clubsToHandOver(c.get("db"), session.id) });
});

// DELETE /account erases through Better Auth's deleteUser (the Worker's deps.deleteUser) so sessions, passkeys and Google and Apple links go too;
// the optional { successors } body falls back to defaults.
accountRoutes.delete("/account", rateLimit("write"), async (c) => {
  const session = requireSession(c);
  const input = await parseOptionalJson(c, deleteAccountInput);
  // A bad pick is refused before anything is deleted.
  await checkSuccessors(c.get("db"), session.id, input.successors);
  const done = await c.get("deleteUser")(c.req.raw, c.env, {
    userId: session.id,
    successors: input.successors,
  });
  if (done === "not_fresh") throw notFresh("delete your account");
  return c.body(null, 204);
});
