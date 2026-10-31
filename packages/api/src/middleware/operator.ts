// Step 2b, /admin/* only: the operator bearer. The admin MCP Worker calls this API over
// a service binding with `Authorization: Bearer <ADMIN_OPERATOR_TOKEN>` and names the
// acting admin in `X-Foxing-Admin-Id`. The bearer proves the caller is the operator; it
// grants nothing by itself. The named actor replaces any cookie session and then goes
// through the same checks a signed-in admin does, read from D1 on every request:
// profileMw blocks a suspended actor's writes and requireAdmin (routes/admin.ts) checks
// is_admin and suspension. A request with no Authorization header is untouched.
import { safeEqual } from "@dustinedwards/site-runtime/compare";
import { OWASP_EVENTS, logEvent, requestFields } from "@dustinedwards/site-runtime/log";
import { adminRepo } from "@foxing/core";
import { createMiddleware } from "hono/factory";
import { AppError } from "../error";
import type { Env } from "../types";

const OPERATOR_ACTOR_HEADER = "X-Foxing-Admin-Id";

// Each refusal is logged under OWASP's names (site-runtime ./log), with the reason and never the token.
const refusedLogged = (request: Request, reason: string, message: string) => {
  logEvent(
    OWASP_EVENTS.signInFailure,
    { ...requestFields(request), door: "operator", reason },
    { level: "warn" },
  );
  return new AppError(401, "unauthorized", message);
};

export const operatorMw = createMiddleware<Env>(async (c, next) => {
  const header = c.req.header("Authorization");
  if (header === undefined) return next();

  const match = /^Bearer (\S+)$/.exec(header);
  const refused = (reason: string, message: string) => refusedLogged(c.req.raw, reason, message);
  if (!match)
    throw refused("not bearer", "Send the operator token as: Authorization: Bearer <token>.");
  const expected = c.env.ADMIN_OPERATOR_TOKEN;
  if (!expected)
    throw refused("not configured", "Operator access is not configured on this Worker.");
  if (!(await safeEqual(match[1], expected)))
    throw refused("wrong token", "Operator token not recognized.");

  const actorId = c.req.header(OPERATOR_ACTOR_HEADER)?.trim();
  if (!actorId)
    throw refused("no actor", `Name the acting admin's user id in ${OPERATOR_ACTOR_HEADER}.`);
  const actor = await adminRepo.getOperatorActor(c.get("db"), actorId);
  if (!actor) {
    logEvent(
      OWASP_EVENTS.authorizationFailure,
      { ...requestFields(c.req.raw), door: "operator", reason: "unknown actor" },
      { level: "warn" },
    );
    throw new AppError(403, "forbidden", "The acting admin does not exist.");
  }

  c.set("session", { id: actor.id, email: actor.email });
  c.set("viaOperator", true);
  await next();
});
