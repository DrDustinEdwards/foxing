import type { BookRef, ShelfStatus } from "./common";

export interface LibraryEntry {
  bookId: string;
  status: ShelfStatus;
  progressPct: number;
  title: string;
  author: string;
  slug: string;
  coverUrl: string | null;
  updatedAt: number;
  finishedAt: number | null;
}

export interface Shelf {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
}

export interface ShelfDetail {
  shelf: Shelf;
  books: BookRef[];
}

export interface Goal {
  id: string;
  type: string;
  target: number;
  periodType: "year" | "month" | "week";
  year: number;
  month: number | null;
  week: number | null;
}

export interface GoalWithProgress {
  goal: Goal;
  progress: number;
}

export interface Streak {
  currentStreak: number;
  longestStreak: number;
  totalBooksFinished: number;
  totalHighlights: number;
  totalPagesRead: number;
  totalWordsLookedUp: number;
  lastReadDate: number | null;
}

export interface VocabularyWord {
  id: string;
  bookId: string | null;
  word: string;
  definition: string;
  contextSentence: string | null;
  mastered: boolean;
  lookedUpAt: number;
}

export interface RecapBook {
  bookId: string;
  title: string;
  author: string;
  slug: string;
  coverUrl: string | null;
  ratingHalf: number | null;
}

/** GET /recap/:year (the reader's own) and /u/:username/recap/:year: Year in Reading. */
export interface RecapPage {
  recap: {
    year: number;
    booksFinished: number;
    totalWords: number;
    distinctAuthors: number;
    averageRating: number | null;
    topBooks: RecapBook[];
    finished: RecapBook[];
  };
  displayName: string;
  username: string;
  monthly: number[];
  genres: { name: string; value: number }[];
}

/** GET /stats: the reader's year in numbers, and the last week of reading sessions. */
export interface ReadingStats {
  year: number;
  finishedThisYear: number;
  monthly: number[];
  genres: { name: string; value: number }[];
  booksYearGoalTarget: number | null;
  streak: Streak;
  /** The last 7 days, oldest first; day is the UTC midnight it starts on. */
  week: { day: number; minutes: number; pages: number }[];
}

export interface MyBookState {
  status: ShelfStatus | null;
  progressPct: number;
  progress: Record<string, unknown> | null;
  shelfIds: string[];
  startedAt: number | null;
  finishedAt: number | null;
}
