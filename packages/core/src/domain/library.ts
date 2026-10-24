// Library domain logic. changeBookStatus is the single write path for shelf
// status: it upserts user_books AND emits the activity/notification events on the
// core write path (never from clients), so web and mobile feeds stay in parity.
// Per the spec-cf-api event catalog: reading -> started_book, finished ->
// finished_book (+ books_finished streak total, + goal_met when a books goal is
// reached). Badge awarding on finish is deferred (see deferred-items.md).
import { eq } from "drizzle-orm";
import type { Db } from "../db";
import type { UserBookStatus } from "../enums";
import { emit, type EventActor } from "../events";
import * as libraryRepo from "../repositories/library";
import * as profilesRepo from "../repositories/profiles";
import { books } from "../schema";

async function bookTitle(db: Db, bookId: string): Promise<string> {
  const rows = await db
    .select({ title: books.title })
    .from(books)
    .where(eq(books.id, bookId))
    .limit(1);
  return rows[0]?.title ?? "";
}

export async function changeBookStatus(
  db: Db,
  actor: EventActor,
  bookId: string,
  status: UserBookStatus,
): Promise<libraryRepo.UserBook> {
  const { row, wasFinished } = await libraryRepo.upsertStatus(db, actor.userId, bookId, status);

  if (status === "reading") {
    const title = await bookTitle(db, bookId);
    await emit(db, "library.status.reading", actor, { bookId, title });
  } else if (status === "finished" && !wasFinished) {
    const title = await bookTitle(db, bookId);
    await emit(db, "library.status.finished", actor, { bookId, title });
    await libraryRepo.incrementBooksFinished(db, actor.userId);

    // goal_met: a books-type goal whose finished count now equals its target.
    const goals = await libraryRepo.listGoals(db, actor.userId);
    for (const g of goals) {
      if (g.type !== "books") continue;
      const progress = await libraryRepo.countFinishedInPeriod(db, actor.userId, g);
      if (progress === g.target) {
        await emit(db, "goal.met", actor, { goalId: g.id, goalType: g.type, target: g.target });
      }
    }
  }

  return row;
}

/** The calendar day (days since 1970-01-01) an instant falls on in the reader's timezone;
 *  UTC when they have none or it is not a zone Intl knows. */
export function localDay(atMs: number, timezone: string | null): number {
  let ymd: string;
  try {
    ymd = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone ?? "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(atMs));
  } catch {
    ymd = new Date(atMs).toISOString().slice(0, 10);
  }
  return Math.round(Date.parse(`${ymd}T00:00:00Z`) / 86_400_000);
}

export interface StreakState {
  current: number;
  longest: number;
  lastDay: number | null;
}

/** A reading session on `day` moves the streak: the same day changes nothing, the next
 *  day extends it, a gap restarts it at 1. A session older than the last reading day (an
 *  offline one arriving late) changes nothing. */
export function nextStreak(prev: StreakState, day: number): StreakState {
  if (prev.lastDay !== null && day <= prev.lastDay) return prev;
  const current = prev.lastDay !== null && day === prev.lastDay + 1 ? prev.current + 1 : 1;
  return { current, longest: Math.max(prev.longest, current), lastDay: day };
}

/** A synced reading session counts its day toward the streak and its pages toward the
 *  total. Days are the reader's own (their profile timezone). */
export async function recordReadingSession(
  db: Db,
  userId: string,
  startedAtMs: number,
  pagesRead: number,
): Promise<void> {
  const [row, profile] = await Promise.all([
    libraryRepo.getStreak(db, userId),
    profilesRepo.getProfileById(db, userId),
  ]);
  const tz = profile?.timezone ?? null;
  const last = row?.lastReadDate ? localDay(row.lastReadDate.getTime(), tz) : null;
  const next = nextStreak(
    { current: row?.currentStreak ?? 0, longest: row?.longestStreak ?? 0, lastDay: last },
    localDay(startedAtMs, tz),
  );
  await libraryRepo.saveStreak(db, userId, {
    currentStreak: next.current,
    longestStreak: next.longest,
    lastReadDate: next.lastDay === last ? (row?.lastReadDate ?? null) : new Date(startedAtMs),
    pagesRead,
  });
}
