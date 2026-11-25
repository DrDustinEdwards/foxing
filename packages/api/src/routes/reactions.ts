// PUT adds, DELETE removes; target existence and owner notification are handled in core.
import { reactionInput, reactionsDomain } from "@foxing/core";
import { Hono } from "hono";
import { actorOf, parseJson } from "../http";
import { rateLimit } from "../middleware/rate-limit";
import type { Env } from "../types";

export const reactionRoutes = new Hono<Env>();

reactionRoutes.put("/reactions", rateLimit("write"), async (c) => {
  const { actor } = actorOf(c);
  const input = await parseJson(c, reactionInput);
  await reactionsDomain.addReaction(c.get("db"), actor, input);
  return c.json({ ok: true }, 201);
});

reactionRoutes.delete("/reactions", rateLimit("write"), async (c) => {
  const { actor } = actorOf(c);
  const input = await parseJson(c, reactionInput);
  await reactionsDomain.removeReaction(c.get("db"), actor, input);
  return c.json({ ok: true });
});
