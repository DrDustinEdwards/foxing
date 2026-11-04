// The operator-only paths (/admin/*, /ops/*) sit behind Cloudflare Access (the family
// sign-in: admins through Access, everyone else through Better Auth). Access stops a
// browser that has not signed in through it before the request reaches the Worker; this
// checks what Access signed: the Worker's checkAdminAccess verifies the token and that its
// email is the signed-in admin's own. The admin MCP Worker's operator bearer
// (operator.ts) is its own proof and skips this. Fails closed: with no checker, or no
// Access settings on the Worker, no browser reaches these paths.
import { OWASP_EVENTS, logEvent, requestFields } from "@dustinedwards/site-runtime/log";
import { createMiddleware } from "hono/factory";
import { errors } from "../error";
import type { ApiDeps, Env } from "../types";

export const adminAccessMw = (deps: ApiDeps) =>
  createMiddleware<Env>(async (c, next) => {
    const session = c.get("session");
    // No session is requireAdmin's 401; the operator bearer is proven already.
    if (!session || c.get("viaOperator")) return next();
    const passed = (await deps.checkAdminAccess?.(c.req.raw, c.env, session.email)) ?? false;
    if (!passed) {
      logEvent(
        OWASP_EVENTS.authorizationFailure,
        { ...requestFields(c.req.raw), door: "admin-access" },
        { level: "warn" },
      );
      throw errors.forbidden("Admin only. Sign in through Cloudflare Access.");
    }
    await next();
  });
