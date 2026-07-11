// Reactions endpoints (Phase 6). Generic like/reaction over the one reactions table.
// PUT adds, DELETE removes. Target existence + owner notification handled in core.
// Phase 6 uses this for reading_list likes and diary_entry (review) likes.
import { reactionInput, reactionsDomain } from "@foxing/core";
import { Hono } from "hono";
import { parseJson, requireSession } from "../http";
import { rateLimit } from "../middleware/rate-limit";
import type { Context } from "hono";
import type { Env } from "../types";

export const reactionRoutes = new Hono<Env>();

function actorOf(c: Context<Env>) {
  const session = requireSession(c);
  return { session, actor: { userId: session.id, timezone: c.get("profile")?.timezone } };
}

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
