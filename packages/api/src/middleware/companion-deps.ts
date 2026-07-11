// Injects the model-calling function into request context, same pattern as
// sessionMw(deps): the Worker builds the real Anthropic-backed caller from
// env.ANTHROPIC_API_KEY; tests inject a stub with no network call and no key.
import { createMiddleware } from "hono/factory";
import type { ApiDeps, Env } from "../types";

export const companionDepsMw = (deps: ApiDeps) =>
  createMiddleware<Env>(async (c, next) => {
    c.set("streamCompanion", deps.resolveCompanionCaller(c.env));
    await next();
  });
