// Injects the Stripe billing client + price ids into request context, same pattern as
// companionDepsMw: the Worker builds the real client from its secrets; tests inject a
// stub with no network call and no keys.
import { createMiddleware } from "hono/factory";
import type { ApiDeps, Env } from "../types";

export const billingDepsMw = (deps: ApiDeps) =>
  createMiddleware<Env>(async (c, next) => {
    c.set("billing", deps.resolveBilling(c.env));
    await next();
  });
