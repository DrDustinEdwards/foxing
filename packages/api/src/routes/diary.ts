// Diary / reviews endpoints. diary_entries is the rating + review home.
// Create respects visibility for feed emission (private -> no event); the book rating
// aggregate is recomputed in core on every write. Handlers stay thin.
import {
  createDiaryInput,
  diaryDomain,
  diaryRepo,
  socialDomain,
  updateDiaryInput,
} from "@foxing/core";
import { Hono } from "hono";
import { errors } from "../error";
import { parseJson, requireSession } from "../http";
import { rateLimit } from "../middleware/rate-limit";
import type { Context } from "hono";
import type { Env } from "../types";

export const diaryRoutes = new Hono<Env>();

function actorOf(c: Context<Env>) {
  const session = requireSession(c);
  return { session, actor: { userId: session.id, timezone: c.get("profile")?.timezone } };
}

// The signed-in user's own diary (all visibilities: it is theirs).
diaryRoutes.get("/diary", async (c) => {
  const session = requireSession(c);
  const entries = await diaryRepo.listEntriesForUser(c.get("db"), session.id, [
    "private",
    "friends",
    "public",
  ]);
  return c.json({ entries });
});

diaryRoutes.post("/diary", rateLimit("write"), async (c) => {
  const { actor } = actorOf(c);
  const input = await parseJson(c, createDiaryInput);
  const entry = await diaryDomain.createEntry(c.get("db"), actor, input);
  return c.json({ entry }, 201);
});

diaryRoutes.get("/diary/:id", async (c) => {
  const session = c.get("session");
  const entry = await diaryRepo.getEntryById(c.get("db"), c.req.param("id"));
  if (!entry) throw errors.notFound("Diary entry not found.");
  // The same audience as the profile page: the author sees everything, a close friend
  // friends and public, anyone else public only (Grok audit 2026-10-21, FX-7).
  const visible = await socialDomain.visibleVisibilitiesFor(
    c.get("db"),
    entry.userId,
    session?.id ?? null,
  );
  if (!visible.includes(entry.visibility)) {
    throw errors.notFound("Diary entry not found.");
  }
  return c.json({ entry });
});

diaryRoutes.patch("/diary/:id", rateLimit("write"), async (c) => {
  const { actor } = actorOf(c);
  const input = await parseJson(c, updateDiaryInput);
  const entry = await diaryDomain.updateEntry(c.get("db"), actor, c.req.param("id"), input);
  return c.json({ entry });
});

diaryRoutes.delete("/diary/:id", rateLimit("write"), async (c) => {
  const { actor } = actorOf(c);
  await diaryDomain.deleteEntry(c.get("db"), actor, c.req.param("id"));
  return c.json({ ok: true });
});
