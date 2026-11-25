import { createMiddleware } from "hono/factory";
import type { ApiDeps, Env } from "../types";

export const companionDepsMw = (deps: ApiDeps) =>
  createMiddleware<Env>(async (c, next) => {
    c.set("streamCompanion", deps.resolveCompanionCaller(c.env));
    c.set("structuredCompanion", deps.resolveStructuredCaller?.(c.env) ?? null);
    await next();
  });
