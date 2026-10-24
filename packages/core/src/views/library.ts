// Library views: the reader's shelf state, shelves, goals, streak, vocabulary and
// notifications in their /api/v1 wire shape (@foxing/types). One function per view,
// called by the web loader in-process and by the matching GET route, so the page's
// first paint and every later refetch are the same object.
import type * as W from "@foxing/types";
import type { Db } from "../db";
import * as libraryRepo from "../repositories/library";
import * as notificationsRepo from "../repositories/notifications";
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
  const rows = await libraryRepo.listGoals(db, userId);
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
        goal.type === "books" ? await libraryRepo.countFinishedInPeriod(db, userId, goal) : 0,
    })),
  );
}

export async function streak(db: Db, userId: string): Promise<W.Streak> {
  const s = await libraryRepo.getStreak(db, userId);
  return {
    currentStreak: s?.currentStreak ?? 0,
    longestStreak: s?.longestStreak ?? 0,
    totalBooksFinished: s?.totalBooksFinished ?? 0,
    totalHighlights: s?.totalHighlights ?? 0,
    totalPagesRead: s?.totalPagesRead ?? 0,
    totalWordsLookedUp: s?.totalWordsLookedUp ?? 0,
    lastReadDate: ms(s?.lastReadDate),
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
  opts: { cursor?: number | null; limit?: number } = {},
): Promise<W.NotificationsPage> {
  const [rows, unread] = await Promise.all([
    notificationsRepo.listForUser(db, userId, { cursor: opts.cursor, limit: opts.limit ?? 50 }),
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
  };
}
