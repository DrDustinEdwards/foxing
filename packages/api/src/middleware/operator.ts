// Step 2b, /admin/* only: the operator bearer (site-runtime ./hono operatorBearer). The admin MCP Worker calls this
// API over a service binding with `Authorization: Bearer <ADMIN_OPERATOR_TOKEN>` and names the acting admin in
// `X-Foxing-Admin-Id`. The bearer proves the caller is the operator; it grants nothing by itself. The named actor
// replaces any cookie session and then goes through the same checks a signed-in admin does, read from D1 on every
// request: profileMw blocks a suspended actor's writes and requireAdmin (routes/admin.ts) checks the actor's email
// against ADMIN_EMAIL and CO_OWNER_EMAILS and its suspension. A request with no Authorization header is untouched.
import { operatorBearer } from "@dustinedwards/site-runtime/hono";
import { adminRepo } from "@foxing/core";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import type { Env } from "../types";

const door = operatorBearer<Context<Env>, { id: string; email: string }>({
  token: (c) => c.env.ADMIN_OPERATOR_TOKEN,
  actorHeader: "X-Foxing-Admin-Id",
  resolveActor: (c, id) => adminRepo.getOperatorActor(c.get("db"), id),
  onActor: (c, actor) => {
    c.set("session", { id: actor.id, email: actor.email });
    c.set("viaOperator", true);
  },
});

export const operatorMw = createMiddleware<Env>(async (c, next) => {
  await door(c, next);
});
