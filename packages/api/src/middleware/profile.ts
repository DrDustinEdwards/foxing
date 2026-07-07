// Step 3: attach the profile (tier, timezone, suspension). Suspended users are
// blocked from writes with a 403.
import { createMiddleware } from "hono/factory";
import { profilesRepo } from "@foxing/core";
import { errors } from "../error";
import type { Env } from "../types";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export const profileMw = createMiddleware<Env>(async (c, next) => {
  const session = c.get("session");
  if (!session) {
    c.set("profile", null);
    return next();
  }
  const profile = await profilesRepo.getProfileById(c.get("db"), session.id);
  c.set("profile", profile);
  if (profile?.isSuspended && WRITE_METHODS.has(c.req.method)) {
    throw errors.forbidden("Account suspended.");
  }
  await next();
});
