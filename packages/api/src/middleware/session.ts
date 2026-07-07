// Step 2: resolve the Better Auth session via the injected resolver (kept out of
// this package so it stays provider-agnostic).
import { createMiddleware } from "hono/factory";
import type { ApiDeps, Env } from "../types";

export const sessionMw = (deps: ApiDeps) =>
  createMiddleware<Env>(async (c, next) => {
    c.set("session", await deps.resolveSession(c.req.raw, c.env));
    await next();
  });
