// Library / tracking write + read surface. Shelf status changes go through the
// core changeBookStatus domain function, which emits the activity/notification
// events (started_book, finished_book, goal_met) on the write path. Handlers stay
// thin: session, validate, call core, return. Reused by Phase 7 mobile as-is.
import { Hono } from "hono";
import {
  changeBookStatus,
  createGoalInput,
  createShelfInput,
  libraryRepo,
  setStatusInput,
  shelfBookInput,
  updateGoalInput,
  updateVocabularyInput,
} from "@foxing/core";
import { errors } from "../error";
import { parseJson, requireSession } from "../http";
import { rateLimit } from "../middleware/rate-limit";
import type { Env } from "../types";

export const libraryRoutes = new Hono<Env>();

// --- Shelf status ----------------------------------------------------------

libraryRoutes.get("/library", async (c) => {
  const session = requireSession(c);
  const library = await libraryRepo.listLibrary(c.get("db"), session.id);
  return c.json({ library });
});

libraryRoutes.put("/library/:bookId", rateLimit("write"), async (c) => {
  const session = requireSession(c);
  const { status } = await parseJson(c, setStatusInput);
  const userBook = await changeBookStatus(
    c.get("db"),
    { userId: session.id, timezone: c.get("profile")?.timezone },
    c.req.param("bookId"),
    status,
  );
  return c.json({ userBook });
});

libraryRoutes.delete("/library/:bookId", rateLimit("write"), async (c) => {
  const session = requireSession(c);
  const ok = await libraryRepo.removeFromLibrary(c.get("db"), session.id, c.req.param("bookId"));
  return c.json({ ok });
});

// --- Custom shelves --------------------------------------------------------

libraryRoutes.get("/shelves", async (c) => {
  const session = requireSession(c);
  const shelves = await libraryRepo.listShelves(c.get("db"), session.id);
  return c.json({ shelves });
});

libraryRoutes.post("/shelves", rateLimit("write"), async (c) => {
  const session = requireSession(c);
  const input = await parseJson(c, createShelfInput);
  const shelf = await libraryRepo.createShelf(c.get("db"), session.id, input);
  return c.json({ shelf }, 201);
});

libraryRoutes.delete("/shelves/:id", rateLimit("write"), async (c) => {
  const session = requireSession(c);
  const ok = await libraryRepo.deleteShelf(c.get("db"), session.id, c.req.param("id"));
  if (!ok) throw errors.notFound("Shelf not found.");
  return c.json({ ok });
});

libraryRoutes.get("/shelves/:id/books", async (c) => {
  const session = requireSession(c);
  const books = await libraryRepo.listShelfBooks(c.get("db"), session.id, c.req.param("id"));
  return c.json({ books });
});

libraryRoutes.post("/shelves/:id/books", rateLimit("write"), async (c) => {
  const session = requireSession(c);
  const { bookId } = await parseJson(c, shelfBookInput);
  const ok = await libraryRepo.addBookToShelf(c.get("db"), session.id, c.req.param("id"), bookId);
  if (!ok) throw errors.notFound("Shelf not found.");
  return c.json({ ok }, 201);
});

libraryRoutes.delete("/shelves/:id/books/:bookId", rateLimit("write"), async (c) => {
  const session = requireSession(c);
  const ok = await libraryRepo.removeBookFromShelf(
    c.get("db"),
    session.id,
    c.req.param("id"),
    c.req.param("bookId"),
  );
  if (!ok) throw errors.notFound("Shelf not found.");
  return c.json({ ok });
});

// --- Reading goals ---------------------------------------------------------

libraryRoutes.get("/goals", async (c) => {
  const session = requireSession(c);
  const db = c.get("db");
  const goals = await libraryRepo.listGoals(db, session.id);
  const withProgress = await Promise.all(
    goals.map(async (goal) => ({
      goal,
      progress:
        goal.type === "books" ? await libraryRepo.countFinishedInPeriod(db, session.id, goal) : 0,
    })),
  );
  return c.json({ goals: withProgress });
});

libraryRoutes.post("/goals", rateLimit("write"), async (c) => {
  const session = requireSession(c);
  const input = await parseJson(c, createGoalInput);
  const goal = await libraryRepo.createGoal(c.get("db"), session.id, input);
  return c.json({ goal }, 201);
});

libraryRoutes.patch("/goals/:id", rateLimit("write"), async (c) => {
  const session = requireSession(c);
  const input = await parseJson(c, updateGoalInput);
  const goal = await libraryRepo.updateGoal(c.get("db"), session.id, c.req.param("id"), input);
  if (!goal) throw errors.notFound("Goal not found.");
  return c.json({ goal });
});

libraryRoutes.delete("/goals/:id", rateLimit("write"), async (c) => {
  const session = requireSession(c);
  const ok = await libraryRepo.deleteGoal(c.get("db"), session.id, c.req.param("id"));
  if (!ok) throw errors.notFound("Goal not found.");
  return c.json({ ok });
});

// --- Vocabulary ------------------------------------------------------------

libraryRoutes.patch("/vocabulary/:id", rateLimit("write"), async (c) => {
  const session = requireSession(c);
  const { mastered } = await parseJson(c, updateVocabularyInput);
  const entry = await libraryRepo.setVocabularyMastered(
    c.get("db"),
    session.id,
    c.req.param("id"),
    mastered,
  );
  if (!entry) throw errors.notFound("Word not found.");
  return c.json({ entry });
});

// --- Streaks ---------------------------------------------------------------

libraryRoutes.get("/streaks/me", async (c) => {
  const session = requireSession(c);
  const streak = await libraryRepo.getStreak(c.get("db"), session.id);
  return c.json({ streak });
});
