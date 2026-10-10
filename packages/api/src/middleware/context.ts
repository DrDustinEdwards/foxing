// Step 1: request id + logging context, and the per-request D1/Drizzle handle.
import { createMiddleware } from "hono/factory";
import { createDb } from "@foxing/core";
import type { Env } from "../types";

export const contextMw = createMiddleware<Env>(async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set("requestId", requestId);
  c.set("db", createDb(c.env.DB));
  c.set("viaOperator", false);
  c.header("x-request-id", requestId);
  await next();
});
