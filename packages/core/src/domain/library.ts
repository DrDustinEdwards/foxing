// changeBookStatus is the single write path for shelf status: it upserts user_books AND emits the events (reading -> started_book,
// finished -> finished_book + books_finished streak total + goal_met), on the core write path so web and mobile feeds stay in parity.
import { eq } from "drizzle-orm";
import type { Db } from "../db";
import type { UserBookStatus } from "../enums";
import { emit, type EventActor } from "../events";
import * as goalsRepo from "../repositories/goals";
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

    // goal_met: a books-type goal whose finished count now equals its target, its period in the reader's days.
    const [goals, profile] = await Promise.all([
      goalsRepo.listGoals(db, actor.userId),
      profilesRepo.getProfileById(db, actor.userId),
    ]);
    for (const g of goals) {
      if (g.type !== "books") continue;
      const progress = await goalsRepo.countFinishedInPeriod(
        db,
        actor.userId,
        g,
        profile?.timezone ?? null,
      );
      if (progress === g.target) {
        await emit(db, "goal.met", actor, { goalId: g.id, goalType: g.type, target: g.target });
      }
    }
  }

  return row;
}

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

/** Same day changes nothing, the next extends the streak, a gap restarts it at 1; an older session (an offline one arriving late) changes nothing. */
export function nextStreak(prev: StreakState, day: number): StreakState {
  if (prev.lastDay !== null && day <= prev.lastDay) return prev;
  const current = prev.lastDay !== null && day === prev.lastDay + 1 ? prev.current + 1 : 1;
  return { current, longest: Math.max(prev.longest, current), lastDay: day };
}

export async function recordReadingSession(
  db: Db,
  userId: string,
  startedAtMs: number,
  pagesRead: number,
): Promise<void> {
  const [row, profile] = await Promise.all([
    goalsRepo.getStreak(db, userId),
    profilesRepo.getProfileById(db, userId),
  ]);
  const tz = profile?.timezone ?? null;
  const last = row?.lastReadDate ? localDay(row.lastReadDate.getTime(), tz) : null;
  const next = nextStreak(
    { current: row?.currentStreak ?? 0, longest: row?.longestStreak ?? 0, lastDay: last },
    localDay(startedAtMs, tz),
  );
  await goalsRepo.saveStreak(db, userId, {
    currentStreak: next.current,
    longestStreak: next.longest,
    lastReadDate: next.lastDay === last ? (row?.lastReadDate ?? null) : new Date(startedAtMs),
    pagesRead,
  });
}
