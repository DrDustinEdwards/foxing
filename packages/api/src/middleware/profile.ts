// Step 3: attach the profile (tier, timezone, suspension). Suspended users are
// blocked from writes with a 403.
import { createMiddleware } from "hono/factory";
import { isAdminAccount, profilesRepo } from "@foxing/core";
import { errors } from "../error";
import type { Env } from "../types";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export const profileMw = createMiddleware<Env>(async (c, next) => {
  const session = c.get("session");
  if (!session) {
    c.set("profile", null);
    return next();
  }
  const row = await profilesRepo.getProfileById(c.get("db"), session.id);
  // Admin is the ADMIN_EMAILS setting once it is set (core isAdminAccount), for every check below.
  const profile = row && {
    ...row,
    isAdmin: isAdminAccount(c.env, session.email, row.isAdmin),
  };
  c.set("profile", profile);
  if (profile?.isSuspended && WRITE_METHODS.has(c.req.method)) {
    throw errors.forbidden("Account suspended.");
  }
  await next();
});
