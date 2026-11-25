import { createMiddleware } from "hono/factory";
import type { ApiDeps, Env } from "../types";

export const billingDepsMw = (deps: ApiDeps) =>
  createMiddleware<Env>(async (c, next) => {
    c.set("billing", deps.resolveBilling(c.env));
    await next();
  });
