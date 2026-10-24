// Social endpoints: follows, close friends, reading lists, the
// activity feed, and Year in Reading recap. Handlers stay thin: guard the session,
// validate, call the core social/recap domain (which authorizes, commits, and emits),
// return. Feed visibility resolves entirely server-side in core -- the client is never
// trusted to say what it may see.
import {
  addListBookInput,
  createListInput,
  socialDomain,
  updateListInput,
  views,
} from "@foxing/core";
import { Hono } from "hono";
import { errors } from "../error";
import { parseJson, requireSession } from "../http";
import { rateLimit } from "../middleware/rate-limit";
import type { Context } from "hono";
import type { Env } from "../types";

export const socialRoutes = new Hono<Env>();

function actorOf(c: Context<Env>) {
  const session = requireSession(c);
  return { session, actor: { userId: session.id, timezone: c.get("profile")?.timezone } };
}

// -- Follows (free) ---------------------------------------------------------

socialRoutes.put("/follows/:userId", rateLimit("write"), async (c) => {
  const { actor } = actorOf(c);
  await socialDomain.followUser(c.get("db"), actor, c.req.param("userId"));
  return c.json({ ok: true }, 201);
});

socialRoutes.delete("/follows/:userId", rateLimit("write"), async (c) => {
  const { actor } = actorOf(c);
  await socialDomain.unfollowUser(c.get("db"), actor, c.req.param("userId"));
  return c.json({ ok: true });
});

// -- Close friends (free; the friends-only visibility audience) -------------
// A social / privacy control, not a Plus feature: it is the audience for friends-only
// diary entries, activity, and shared annotations, all part of the free social layer.

socialRoutes.put("/close-friends/:userId", rateLimit("write"), async (c) => {
  const { actor } = actorOf(c);
  await socialDomain.addCloseFriend(c.get("db"), actor, c.req.param("userId"));
  return c.json({ ok: true }, 201);
});

socialRoutes.delete("/close-friends/:userId", rateLimit("write"), async (c) => {
  const { actor } = actorOf(c);
  await socialDomain.removeCloseFriend(c.get("db"), actor, c.req.param("userId"));
  return c.json({ ok: true });
});

// Who the viewer follows, who follows them, and their close friends.
socialRoutes.get("/people", async (c) => {
  const session = requireSession(c);
  return c.json(await views.people(c.get("db"), session.id));
});

// -- Reading lists ----------------------------------------------------------

socialRoutes.get("/lists", async (c) => {
  const session = requireSession(c);
  return c.json(await views.myLists(c.get("db"), session.id));
});

socialRoutes.post("/lists", rateLimit("write"), async (c) => {
  const { actor } = actorOf(c);
  const input = await parseJson(c, createListInput);
  const list = await socialDomain.createList(c.get("db"), actor, input);
  return c.json({ list }, 201);
});

socialRoutes.patch("/lists/:id", rateLimit("write"), async (c) => {
  const { actor } = actorOf(c);
  const input = await parseJson(c, updateListInput);
  const list = await socialDomain.updateList(c.get("db"), actor, c.req.param("id"), input);
  return c.json({ list });
});

socialRoutes.delete("/lists/:id", rateLimit("write"), async (c) => {
  const { actor } = actorOf(c);
  await socialDomain.deleteList(c.get("db"), actor, c.req.param("id"));
  return c.json({ ok: true });
});

socialRoutes.put("/lists/:id/books", rateLimit("write"), async (c) => {
  const { actor } = actorOf(c);
  const input = await parseJson(c, addListBookInput);
  const book = await socialDomain.addBookToList(c.get("db"), actor, c.req.param("id"), input);
  return c.json({ book }, 201);
});

socialRoutes.delete("/lists/:id/books/:bookId", rateLimit("write"), async (c) => {
  const { actor } = actorOf(c);
  await socialDomain.removeBookFromList(
    c.get("db"),
    actor,
    c.req.param("id"),
    c.req.param("bookId"),
  );
  return c.json({ ok: true });
});

// Public list read: a private list is visible only to its owner.
socialRoutes.get("/lists/:id", async (c) => {
  const page = await views.listPage(c.get("db"), c.req.param("id"), c.get("session")?.id ?? null);
  if (!page) throw errors.notFound("List not found.");
  return c.json(page);
});

// -- Feed -------------------------------------------------------------------
// Server-side visibility resolution. The viewer is always the session user; there is no
// way to request "someone else's feed".

socialRoutes.get("/feed", async (c) => {
  const session = requireSession(c);
  const cursor = c.req.query("cursor");
  return c.json(await views.feed(c.get("db"), session.id, cursor ? Number(cursor) : null));
});

// -- Recap ------------------------------------------------------------------

socialRoutes.get("/recap/:year", async (c) => {
  const session = requireSession(c);
  const year = Number(c.req.param("year"));
  if (!Number.isInteger(year)) throw errors.validation({ year: "expected a year" });
  const recap = await views.recap(c.get("db"), { userId: session.id }, year, session.id);
  if (!recap) throw errors.notFound("Profile not found.");
  return c.json(recap);
});

// Public recap: only when the target profile is public (or is the viewer's own).
socialRoutes.get("/u/:username/recap/:year", async (c) => {
  const year = Number(c.req.param("year"));
  if (!Number.isInteger(year)) throw errors.validation({ year: "expected a year" });
  const recap = await views.recap(
    c.get("db"),
    { username: c.req.param("username") },
    year,
    c.get("session")?.id ?? null,
  );
  if (!recap) throw errors.notFound("Profile not found.");
  return c.json(recap);
});
