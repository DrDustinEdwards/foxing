import { createMiddleware } from "hono/factory";
import type { ApiDeps, Env } from "../types";

export const sessionMw = (deps: ApiDeps) =>
  createMiddleware<Env>(async (c, next) => {
    c.set("session", await deps.resolveSession(c.req.raw, c.env));
    await next();
  });
