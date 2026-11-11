// Library views: the reader's shelf state, shelves, goals, streak, vocabulary and
// notifications in their /api/v1 wire shape (@foxing/types). One function per view,
// called by the web loader in-process and by the matching GET route, so the page's
// first paint and every later refetch are the same object.
import { decodeCursor, encodeCursor } from "@dustinedwards/site-runtime/d1";
import type * as W from "@foxing/types";
import type { Db } from "../db";
import * as annotationsRepo from "../repositories/annotations";
import * as libraryRepo from "../repositories/library";
import * as notificationsRepo from "../repositories/notifications";
import * as profilesRepo from "../repositories/profiles";
import { localDay } from "../domain/library";
import { ms } from "./wire";

export async function library(db: Db, userId: string): Promise<W.LibraryEntry[]> {
  const rows = await libraryRepo.listLibrary(db, userId);
  return rows.map((e) => ({
    bookId: e.bookId,
    status: e.status as W.ShelfStatus,
    progressPct: e.progressPct,
    title: e.title,
    author: e.author,
    slug: e.slug,
    coverUrl: e.coverUrl,
    updatedAt: e.updatedAt.getTime(),
    finishedAt: ms(e.finishedAt),
  }));
}

export async function shelves(db: Db, userId: string): Promise<W.Shelf[]> {
  const rows = await libraryRepo.listShelves(db, userId);
  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    isPublic: s.isPublic,
  }));
}

/** A shelf the reader owns with its books, or null when it is not theirs. */
export async function shelfDetail(
  db: Db,
  userId: string,
  shelfId: string,
): Promise<W.ShelfDetail | null> {
  const shelf = (await shelves(db, userId)).find((s) => s.id === shelfId);
  if (!shelf) return null;
  const books = await libraryRepo.listShelfBooks(db, userId, shelfId);
  return {
    shelf,
    books: books.map((b) => ({
      id: b.bookId,
      slug: b.slug,
      title: b.title,
      author: b.author,
      coverUrl: b.coverUrl,
    })),
  };
}

/** Goals with progress; books-type goals count finishes in their period. */
export async function goals(db: Db, userId: string): Promise<W.GoalWithProgress[]> {
  const [rows, profile] = await Promise.all([
    libraryRepo.listGoals(db, userId),
    profilesRepo.getProfileById(db, userId),
  ]);
  const tz = profile?.timezone ?? null;
  return Promise.all(
    rows.map(async (goal) => ({
      goal: {
        id: goal.id,
        type: goal.type,
        target: goal.target,
        periodType: goal.periodType as W.Goal["periodType"],
        year: goal.year,
        month: goal.month,
        week: goal.week,
      },
      progress:
        goal.type === "books" ? await libraryRepo.countFinishedInPeriod(db, userId, goal, tz) : 0,
    })),
  );
}

/** The day streak reads 0 once a full day has passed without reading. */
export async function streak(db: Db, userId: string, now = Date.now()): Promise<W.Streak> {
  const [s, profile] = await Promise.all([
    libraryRepo.getStreak(db, userId),
    profilesRepo.getProfileById(db, userId),
  ]);
  const tz = profile?.timezone ?? null;
  const lapsed = !s?.lastReadDate || localDay(now, tz) - localDay(s.lastReadDate.getTime(), tz) > 1;
  return {
    currentStreak: lapsed ? 0 : (s?.currentStreak ?? 0),
    longestStreak: s?.longestStreak ?? 0,
    totalBooksFinished: s?.totalBooksFinished ?? 0,
    totalHighlights: s?.totalHighlights ?? 0,
    totalPagesRead: s?.totalPagesRead ?? 0,
    totalWordsLookedUp: s?.totalWordsLookedUp ?? 0,
    lastReadDate: ms(s?.lastReadDate),
  };
}

const DAY_MS = 86_400_000;

/** Books finished in each month of a year and the year's most-read subjects, the shape
 *  both the stats page and the Year in Reading recap chart. */
export async function finishedSpread(
  db: Db,
  userId: string,
  year: number,
  timezone: string | null = null,
): Promise<Pick<W.ReadingStats, "monthly" | "genres">> {
  // A day either side, so a finish late on Dec 31 or early on Jan 1 in the reader's own zone is read, then each
  // finish is placed by its local calendar day: the same day the streak counts.
  const finished = await libraryRepo.listFinishedInRangeForStats(
    db,
    userId,
    Date.UTC(year, 0, 1) - DAY_MS,
    Date.UTC(year + 1, 0, 1) + DAY_MS,
  );
  const monthly = Array<number>(12).fill(0);
  const genreCounts = new Map<string, number>();
  for (const b of finished) {
    if (!b.finishedAt) continue;
    const local = new Date(localDay(b.finishedAt.getTime(), timezone) * DAY_MS);
    if (local.getUTCFullYear() !== year) continue;
    monthly[local.getUTCMonth()] += 1;
    for (const subject of b.subjects ?? []) {
      const name = subject.trim();
      if (name) genreCounts.set(name, (genreCounts.get(name) ?? 0) + 1);
    }
  }
  return {
    monthly,
    genres: [...genreCounts.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6),
  };
}

export async function stats(db: Db, userId: string, now = Date.now()): Promise<W.ReadingStats> {
  // Every bucket is a day in the reader's own timezone, as the streak is: `day` is that calendar day's UTC
  // midnight, so a client reading it as a UTC date gets the reader's date.
  const profile = await profilesRepo.getProfileById(db, userId);
  const tz = profile?.timezone ?? null;
  const today = localDay(now, tz) * DAY_MS;
  const year = new Date(today).getUTCFullYear();
  const weekStart = today - 6 * DAY_MS;
  const [finishedThisYear, goals, spread, s, sessions] = await Promise.all([
    libraryRepo.countFinishedInPeriod(db, userId, { periodType: "year", year }, tz),
    libraryRepo.listGoals(db, userId),
    finishedSpread(db, userId, year, tz),
    streak(db, userId, now),
    // A day earlier than the local week start: UTC+14 is a day ahead of UTC.
    libraryRepo.listSessionsSince(db, userId, weekStart - DAY_MS),
  ]);

  const week = Array.from({ length: 7 }, (_, i) => ({
    day: weekStart + i * DAY_MS,
    minutes: 0,
    pages: 0,
  }));
  for (const session of sessions) {
    const start = session.startedAt.getTime();
    const slot = week[localDay(start, tz) - weekStart / DAY_MS];
    if (!slot) continue;
    slot.pages += session.pagesRead;
    if (session.endedAt) slot.minutes += Math.round((session.endedAt.getTime() - start) / 60_000);
  }

  return {
    year,
    finishedThisYear,
    ...spread,
    booksYearGoalTarget:
      goals.find((g) => g.type === "books" && g.periodType === "year")?.target ?? null,
    streak: s,
    week,
  };
}

export async function vocabulary(db: Db, userId: string): Promise<W.VocabularyWord[]> {
  const rows = await libraryRepo.listVocabulary(db, userId);
  return rows.map((w) => ({
    id: w.id,
    bookId: w.bookId,
    word: w.word,
    definition: w.definition,
    contextSentence: w.contextSentence,
    mastered: w.mastered,
    lookedUpAt: w.lookedUpAt.getTime(),
  }));
}

/** Where one book sits in the reader's library. A book they have never touched is
 *  status null, no progress, on no shelves. */
export async function myBook(db: Db, userId: string, bookId: string): Promise<W.MyBookState> {
  const [row, shelfIds] = await Promise.all([
    libraryRepo.getUserBook(db, userId, bookId),
    libraryRepo.shelfIdsForBook(db, userId, bookId),
  ]);
  return {
    status: (row?.status as W.ShelfStatus | undefined) ?? null,
    progressPct: row?.progressPct ?? 0,
    progress: row?.progress ?? null,
    shelfIds,
    startedAt: ms(row?.startedAt),
    finishedAt: ms(row?.finishedAt),
  };
}

export async function notifications(
  db: Db,
  userId: string,
  opts: { cursor?: string | null; limit?: number } = {},
): Promise<W.NotificationsPage> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const [rows, unread] = await Promise.all([
    notificationsRepo.listForUser(db, userId, { cursor: decodeCursor(opts.cursor), limit }),
    notificationsRepo.unreadCount(db, userId),
  ]);
  return {
    notifications: rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      data: n.data ?? {},
      isRead: n.isRead,
      createdAt: n.createdAt.getTime(),
    })),
    unread,
    nextCursor:
      rows.length === limit
        ? encodeCursor(rows[limit - 1]!.createdAt.getTime(), rows[limit - 1]!.id)
        : null,
  };
}

export async function myAnnotations(
  db: Db,
  userId: string,
  types: W.AnnotationType[],
): Promise<W.MyAnnotation[]> {
  const rows = await annotationsRepo.listForUser(db, userId, { types });
  return rows.map((a) => ({
    ...a,
    type: a.type as W.AnnotationType,
    visibility: a.visibility as W.MyAnnotation["visibility"],
    createdAt: a.createdAt.getTime(),
  }));
}
