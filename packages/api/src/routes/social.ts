// Social endpoints: follows, close friends, reading lists, the
// activity feed, and Year in Reading recap. Handlers stay thin: guard the session,
// validate, call the core social/recap domain (which authorizes, commits, and emits),
// return. Feed visibility resolves entirely server-side in core -- the client is never
// trusted to say what it may see.
import {
  addListBookInput,
  createListInput,
  profilesRepo,
  recapDomain,
  socialDomain,
  socialRepo,
  updateListInput,
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

socialRoutes.get("/close-friends", async (c) => {
  const session = requireSession(c);
  const ids = await socialRepo.listCloseFriendIds(c.get("db"), session.id);
  return c.json({ friendIds: ids });
});

// -- Reading lists ----------------------------------------------------------

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
  const db = c.get("db");
  const session = c.get("session");
  const list = await socialRepo.getListById(db, c.req.param("id"));
  if (!list) throw errors.notFound("List not found.");
  if (!list.isPublic && list.userId !== session?.id) throw errors.notFound("List not found.");
  const books = await socialRepo.listBooks(db, list.id);
  return c.json({ list, books });
});

// -- Feed -------------------------------------------------------------------
// Server-side visibility resolution. The viewer is always the session user; there is no
// way to request "someone else's feed".

socialRoutes.get("/feed", async (c) => {
  const session = requireSession(c);
  const cursor = c.req.query("cursor");
  const feed = await socialDomain.getFeed(c.get("db"), session.id, {
    cursor: cursor ? Number(cursor) : null,
  });
  return c.json(feed);
});

// -- Recap ------------------------------------------------------------------

socialRoutes.get("/recap/:year", async (c) => {
  const session = requireSession(c);
  const year = Number(c.req.param("year"));
  if (!Number.isInteger(year)) throw errors.validation({ year: "expected a year" });
  const recap = await recapDomain.getRecap(c.get("db"), session.id, year);
  return c.json({ recap });
});

// Public recap: only when the target profile is public.
socialRoutes.get("/u/:username/recap/:year", async (c) => {
  const db = c.get("db");
  const year = Number(c.req.param("year"));
  if (!Number.isInteger(year)) throw errors.validation({ year: "expected a year" });
  const profile = await profilesRepo.getProfileByUsername(db, c.req.param("username"));
  if (!profile) throw errors.notFound("Profile not found.");
  if ((profile.visibility?.profile ?? "public") !== "public") {
    throw errors.notFound("Profile not found.");
  }
  const recap = await recapDomain.getRecap(db, profile.id, year);
  return c.json({ recap, profile: profilesRepo.toPublicProfile(profile) });
});
