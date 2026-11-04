// Sample reading data for the chart demos (/demos/stats, /demos/year, /demos/goals): the signed-in
// pages' charts with made-up numbers, so a live check can open them without a sign-in. Nothing here
// is read from D1 or belongs to a reader. The year is the current one, and months still to come are
// empty, so the drawings look as they would today.
import type { ReadingStats, RecapPage, Streak } from "@foxing/types";

const MONTHLY = [3, 2, 4, 3, 5, 2, 6, 4, 3, 5, 4, 3];
const GENRES = [
  { name: "Fiction", value: 14 },
  { name: "Mystery", value: 9 },
  { name: "Poetry", value: 6 },
  { name: "Science", value: 5 },
  { name: "History", value: 4 },
];
// Books finished in each of 53 weeks, oldest first: a repeating, uneven pattern.
const WEEK_PATTERN = [0, 1, 0, 2, 1, 0, 0, 1, 3, 0, 1, 1, 0];

const DAY_MS = 86_400_000;

function monthlySoFar(now: Date): number[] {
  const month = now.getUTCMonth();
  return MONTHLY.map((n, i) => (i <= month ? n : 0));
}

function streakFor(finished: number): Streak {
  return {
    currentStreak: 6,
    longestStreak: 21,
    totalBooksFinished: finished + 37,
    totalHighlights: 412,
    totalPagesRead: 18_940,
    totalWordsLookedUp: 96,
    lastReadDate: null,
  };
}

/** The stats page's data, as its loader returns it. */
export function sampleStats(now = new Date()) {
  const monthly = monthlySoFar(now);
  const finishedThisYear = monthly.reduce((a, b) => a + b, 0);
  const stats: ReadingStats = {
    year: now.getUTCFullYear(),
    finishedThisYear,
    monthly,
    genres: GENRES,
    booksYearGoalTarget: 52,
    streak: streakFor(finishedThisYear),
    week: [],
  };
  return {
    ...stats,
    goals: [{ id: "sample-goal", type: "books", target: 52, periodType: "year" }],
  };
}

/** The year page's data, as its loader returns it, for the current year only. */
export function sampleYear(now = new Date()) {
  const year = now.getUTCFullYear();
  const monthly = monthlySoFar(now);
  const booksFinished = monthly.reduce((a, b) => a + b, 0);
  const page: RecapPage = {
    recap: {
      year,
      booksFinished,
      totalWords: booksFinished * 84_000,
      distinctAuthors: booksFinished - 6,
      averageRating: 3.9,
      topBooks: [],
      finished: [],
    },
    displayName: "Alex Rivera",
    username: "sample",
    monthly,
    genres: GENRES,
  };
  return { ...page, year, years: [year] };
}

/** The goals page's reading activity: 53 Sunday-first weeks ending this week, and the streak. */
export function sampleActivity(now = new Date()) {
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const lastSunday = todayUTC - new Date(todayUTC).getUTCDay() * DAY_MS;
  const firstSunday = lastSunday - 52 * 7 * DAY_MS;
  const weeks = Array.from({ length: 53 }, (_, w) => ({
    start: firstSunday + w * 7 * DAY_MS,
    books: WEEK_PATTERN[w % WEEK_PATTERN.length],
  }));
  const finished = weeks.reduce((a, w) => a + w.books, 0);
  return { weeks, streak: streakFor(finished) };
}
