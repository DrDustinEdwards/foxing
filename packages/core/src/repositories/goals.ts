// Reading goals, their periods, streaks and reading sessions, all user-scoped.
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { Db } from "../db";
import { readingGoals, readingSessions, readingStreaks, userBooks } from "../schema";
import type { CreateGoalInput, UpdateGoalInput } from "../validators/library";

export type ReadingGoal = typeof readingGoals.$inferSelect;
export type ReadingStreak = typeof readingStreaks.$inferSelect;

export async function createGoal(
  db: Db,
  userId: string,
  input: CreateGoalInput,
): Promise<ReadingGoal> {
  const [row] = await db
    .insert(readingGoals)
    .values({
      userId,
      type: input.type,
      target: input.target,
      periodType: input.periodType,
      year: input.year,
      month: input.month ?? null,
      week: input.week ?? null,
    })
    .returning();
  return row;
}

export async function updateGoal(
  db: Db,
  userId: string,
  goalId: string,
  patch: UpdateGoalInput,
): Promise<ReadingGoal | null> {
  const [row] = await db
    .update(readingGoals)
    .set({ target: patch.target, ...(patch.type ? { type: patch.type } : {}) })
    .where(and(eq(readingGoals.id, goalId), eq(readingGoals.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteGoal(db: Db, userId: string, goalId: string): Promise<boolean> {
  const rows = await db
    .delete(readingGoals)
    .where(and(eq(readingGoals.id, goalId), eq(readingGoals.userId, userId)))
    .returning({ id: readingGoals.id });
  return rows.length > 0;
}

export async function listGoals(db: Db, userId: string): Promise<ReadingGoal[]> {
  return db
    .select()
    .from(readingGoals)
    .where(eq(readingGoals.userId, userId))
    .orderBy(desc(readingGoals.year));
}

/** The instant a local calendar day starts, from its UTC midnight; the UTC midnight itself when there is no zone or Intl does not know it. */
export function localMidnight(dayStartUtc: number, timezone: string | null): number {
  if (!timezone) return dayStartUtc;
  const offset = (at: number): number => {
    try {
      const parts = Object.fromEntries(
        new Intl.DateTimeFormat("en-US", {
          timeZone: timezone,
          hourCycle: "h23",
          year: "numeric",
          month: "numeric",
          day: "numeric",
          hour: "numeric",
          minute: "numeric",
        })
          .formatToParts(new Date(at))
          .map((p) => [p.type, Number(p.value)]),
      ) as Record<string, number>;
      const wall = Date.UTC(parts.year!, parts.month! - 1, parts.day!, parts.hour!, parts.minute!);
      return wall - Math.floor(at / 60_000) * 60_000;
    } catch {
      return 0;
    }
  };
  // Two steps settle a day whose offset changes (a daylight saving switch) between UTC midnight and local midnight.
  const first = dayStartUtc - offset(dayStartUtc);
  return dayStartUtc - offset(first);
}

/** Half-open [start, end) range for a goal period in the reader's timezone, so goal progress counts the same days as streak and stats. */
export function periodRange(
  periodType: string,
  year: number,
  month?: number | null,
  week?: number | null,
  timezone: string | null = null,
): { start: Date; end: Date } {
  const { start, end } = utcPeriodRange(periodType, year, month, week);
  return {
    start: new Date(localMidnight(start.getTime(), timezone)),
    end: new Date(localMidnight(end.getTime(), timezone)),
  };
}

function utcPeriodRange(
  periodType: string,
  year: number,
  month?: number | null,
  week?: number | null,
): { start: Date; end: Date } {
  if (periodType === "month" && month) {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    return { start, end };
  }
  if (periodType === "week" && week) {
    // ISO week: week 1 contains the year's first Thursday; weeks start Monday.
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const jan4Dow = (jan4.getUTCDay() + 6) % 7; // 0 = Monday
    const week1Monday = new Date(jan4);
    week1Monday.setUTCDate(jan4.getUTCDate() - jan4Dow);
    const start = new Date(week1Monday);
    start.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 7);
    return { start, end };
  }
  return { start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year + 1, 0, 1)) };
}

export async function countFinishedInPeriod(
  db: Db,
  userId: string,
  goal: { periodType: string; year: number; month?: number | null; week?: number | null },
  timezone: string | null = null,
): Promise<number> {
  const { start, end } = periodRange(goal.periodType, goal.year, goal.month, goal.week, timezone);
  const rows = await db
    .select({ n: sql<number>`count(*)` })
    .from(userBooks)
    .where(
      and(
        eq(userBooks.userId, userId),
        eq(userBooks.status, "finished"),
        sql`${userBooks.finishedAt} >= ${start.getTime()} AND ${userBooks.finishedAt} < ${end.getTime()}`,
      ),
    );
  return Number(rows[0]?.n ?? 0);
}

export async function getStreak(db: Db, userId: string): Promise<ReadingStreak | null> {
  const rows = await db
    .select()
    .from(readingStreaks)
    .where(eq(readingStreaks.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function saveStreak(
  db: Db,
  userId: string,
  next: {
    currentStreak: number;
    longestStreak: number;
    lastReadDate: Date | null;
    pagesRead: number;
  },
): Promise<void> {
  const now = new Date();
  await db
    .insert(readingStreaks)
    .values({
      userId,
      currentStreak: next.currentStreak,
      longestStreak: next.longestStreak,
      lastReadDate: next.lastReadDate,
      totalPagesRead: next.pagesRead,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: readingStreaks.userId,
      set: {
        currentStreak: next.currentStreak,
        longestStreak: next.longestStreak,
        lastReadDate: next.lastReadDate,
        totalPagesRead: sql`${readingStreaks.totalPagesRead} + ${next.pagesRead}`,
        updatedAt: now,
      },
    });
}

export async function listSessionsSince(db: Db, userId: string, sinceMs: number) {
  return db
    .select({
      startedAt: readingSessions.startedAt,
      endedAt: readingSessions.endedAt,
      pagesRead: readingSessions.pagesRead,
    })
    .from(readingSessions)
    .where(and(eq(readingSessions.userId, userId), sql`${readingSessions.startedAt} >= ${sinceMs}`))
    .orderBy(asc(readingSessions.startedAt));
}
