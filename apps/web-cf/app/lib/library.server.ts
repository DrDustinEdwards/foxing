// Library page data, loaded in-process via core (the standing rule: loaders never
// self-fetch the Worker's own /api/v1). Kept React-free so it can be unit tested
// against D1 without importing the route's client components.
import { createDb, libraryRepo } from "@foxing/core";

export interface Entry {
  bookId: string;
  status: string;
  progressPct: number;
  title: string;
  author: string;
  slug: string;
  coverUrl: string | null;
}
export interface Shelf {
  id: string;
  name: string;
  description: string | null;
}
export interface GoalRow {
  goal: { id: string; type: string; target: number; periodType: string; year: number };
  progress: number;
}
export interface Streak {
  currentStreak: number;
  longestStreak: number;
  totalBooksFinished: number;
}
export interface LibraryData {
  library: Entry[];
  shelves: Shelf[];
  goals: GoalRow[];
  streak: Streak | null;
}

export async function loadLibraryData(env: Env, userId: string): Promise<LibraryData> {
  const db = createDb(env.DB);
  const [library, shelves, goalRows, streak] = await Promise.all([
    libraryRepo.listLibrary(db, userId),
    libraryRepo.listShelves(db, userId),
    libraryRepo.listGoals(db, userId),
    libraryRepo.getStreak(db, userId),
  ]);
  const goals = await Promise.all(
    goalRows.map(async (goal) => ({
      goal,
      progress:
        goal.type === "books" ? await libraryRepo.countFinishedInPeriod(db, userId, goal) : 0,
    })),
  );

  // Map to the view shapes the cards expect; core rows carry extra columns.
  return {
    library: library.map((e) => ({
      bookId: e.bookId,
      status: e.status,
      progressPct: e.progressPct,
      title: e.title,
      author: e.author,
      slug: e.slug,
      coverUrl: e.coverUrl,
    })),
    shelves: shelves.map((s) => ({ id: s.id, name: s.name, description: s.description })),
    goals: goals.map(({ goal, progress }) => ({
      goal: {
        id: goal.id,
        type: goal.type,
        target: goal.target,
        periodType: goal.periodType,
        year: goal.year,
      },
      progress,
    })),
    streak: streak
      ? {
          currentStreak: streak.currentStreak,
          longestStreak: streak.longestStreak,
          totalBooksFinished: streak.totalBooksFinished,
        }
      : null,
  };
}
