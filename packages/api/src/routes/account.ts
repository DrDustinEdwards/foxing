// Account data rights (spec-cf-api Phase 3): GDPR export and erasure. Thin: guard
// the session, call the core function, return. The heavy lifting (which tables are
// user-owned, delete order) lives in @foxing/core domain/account.
import { Hono } from "hono";
import { checkSuccessors, clubsToHandOver, deleteAccountInput, exportAccount } from "@foxing/core";
import { AppError, errors } from "../error";
import { readBody, requireSession } from "../http";
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

// GET /account/export - every user-owned table as a downloadable JSON archive. It hands over
// everything, so it needs a sign-in from the last 10 minutes, as deleting does.
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

// GET /account/clubs - the clubs the user created, who may take each over, and the default.
accountRoutes.get("/account/clubs", async (c) => {
  const session = requireSession(c);
  return c.json({ clubs: await clubsToHandOver(c.get("db"), session.id) });
});

// DELETE /account - hand over the user's clubs as chosen, then erase the account and all
// user-owned data through Better Auth's deleteUser (the Worker's deps.deleteUser), so its
// sessions, passkeys and Google and Apple links go too and the reader is told. The body
// ({ successors }) is optional: an empty one takes the defaults.
accountRoutes.delete("/account", rateLimit("write"), async (c) => {
  const session = requireSession(c);
  const text = await readBody(c);
  let raw: unknown = {};
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw errors.validation({ body: "expected a JSON body" });
  }
  const input = deleteAccountInput.safeParse(raw);
  if (!input.success) throw errors.validation(input.error.flatten());
  // A bad pick is refused before anything is deleted.
  await checkSuccessors(c.get("db"), session.id, input.data.successors);
  const done = await c.get("deleteUser")(c.req.raw, c.env, {
    userId: session.id,
    successors: input.data.successors,
  });
  if (done === "not_fresh") throw notFresh("delete your account");
  return c.body(null, 204);
});
