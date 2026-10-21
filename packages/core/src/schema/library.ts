// Library and tracking. profiles.id == better-auth user id.
// Ratings/reviews live ONLY in diary_entries (Letterboxd model); user_books is
// shelf state only. FKs cascade from the user root for GDPR deletion.
import {
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  index,
  unique,
} from "drizzle-orm/sqlite-core";
import { bool, createdAt, idPk, json, ts, updatedAt } from "./_helpers";
import { user } from "./auth";
import { books } from "./catalog";

/** Readium Locator JSON, canonical everywhere. Shape validated in core, not here. */
type Locator = Record<string, unknown>;

/** profiles.visibility json: profile/progress/default-annotation visibilities. */
type VisibilityPrefs = {
  profile?: string;
  progress?: string;
  defaultAnnotation?: string;
};

/** notification_prefs json (api delta): per-category booleans + quiet hours. */
type NotificationPrefs = {
  categories?: Record<string, boolean>;
  quietHours?: { start: string; end: string };
};

export const profiles = sqliteTable("profiles", {
  id: text("id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  username: text("username").notNull().unique(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  backdropUrl: text("backdrop_url"),
  bio: text("bio"),
  customUrl: text("custom_url"),
  favoriteGenres: json<string[]>("favorite_genres"),
  languagePreference: text("language_preference"),
  themePreference: text("theme_preference"),
  subscriptionTier: text("subscription_tier").notNull().default("free"), // free | plus
  // Stripe billing. The webhook is the single writer of these + tier.
  stripeCustomerId: text("stripe_customer_id"),
  subscriptionStatus: text("subscription_status"), // Stripe status: active|trialing|past_due|canceled|...
  subscriptionPeriodEnd: ts("subscription_period_end"), // current period end (renewal / trial end)
  visibility: json<VisibilityPrefs>("visibility"),
  notificationPrefs: json<NotificationPrefs>("notification_prefs"),
  isAdmin: bool("is_admin").notNull().default(false),
  isSuspended: bool("is_suspended").notNull().default(false),
  timezone: text("timezone"),
  onboardedAt: ts("onboarded_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const userBooks = sqliteTable(
  "user_books",
  {
    id: idPk(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    bookId: text("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    status: text("status").notNull(), // want | reading | finished | paused | abandoned
    progress: json<Locator>("progress"),
    progressPct: real("progress_pct").notNull().default(0),
    startedAt: ts("started_at"),
    finishedAt: ts("finished_at"),
    pausedAt: ts("paused_at"),
    pausedNote: text("paused_note"),
    abandonedAt: ts("abandoned_at"),
    formatRead: text("format_read"),
    moodTags: json<string[]>("mood_tags"),
    personalNotes: text("personal_notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("user_books_user_book_uq").on(t.userId, t.bookId),
    index("user_books_user_idx").on(t.userId),
    index("user_books_updated_idx").on(t.updatedAt),
  ],
);

export const diaryEntries = sqliteTable(
  "diary_entries",
  {
    id: idPk(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    bookId: text("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    logDate: ts("log_date").notNull(),
    ratingHalf: integer("rating_half"), // 1-10 halves
    review: text("review"),
    containsSpoilers: bool("contains_spoilers").notNull().default(false),
    visibility: text("visibility").notNull().default("private"), // private | friends | public
    slug: text("slug"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("diary_user_book_idx").on(t.userId, t.bookId),
    index("diary_updated_idx").on(t.updatedAt),
  ],
);

export const readingSessions = sqliteTable(
  "reading_sessions",
  {
    id: idPk(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    bookId: text("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    startedAt: ts("started_at").notNull(),
    endedAt: ts("ended_at"),
    pagesRead: integer("pages_read").notNull().default(0),
    avgWpm: real("avg_wpm"),
    lastWpm: real("last_wpm"),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_book_idx").on(t.userId, t.bookId)],
);

export const readingStreaks = sqliteTable("reading_streaks", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastReadDate: ts("last_read_date"),
  streakFreezeCredits: integer("streak_freeze_credits").notNull().default(0),
  totalBooksFinished: integer("total_books_finished").notNull().default(0),
  totalPagesRead: integer("total_pages_read").notNull().default(0),
  totalHighlights: integer("total_highlights").notNull().default(0),
  totalWordsLookedUp: integer("total_words_looked_up").notNull().default(0),
  updatedAt: updatedAt(),
});

export const readingGoals = sqliteTable(
  "reading_goals",
  {
    id: idPk(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // books | pages | minutes
    target: integer("target").notNull(),
    periodType: text("period_type").notNull(), // year | month | week
    year: integer("year").notNull(),
    month: integer("month"),
    week: integer("week"),
    createdAt: createdAt(),
  },
  (t) => [index("goals_user_idx").on(t.userId)],
);

export const vocabulary = sqliteTable(
  "vocabulary",
  {
    id: idPk(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    bookId: text("book_id").references(() => books.id, { onDelete: "set null" }),
    word: text("word").notNull(),
    definition: text("definition").notNull(),
    contextSentence: text("context_sentence"),
    aiContext: text("ai_context"),
    mastered: bool("mastered").notNull().default(false),
    lookedUpAt: ts("looked_up_at").notNull(),
    createdAt: createdAt(),
    // Nullable so the additive migration needs no backfill default (SQLite forbids a
    // NOT NULL ADD COLUMN without one). Sync coalesces null -> created_at for LWW/pull.
    updatedAt: ts("updated_at"),
  },
  (t) => [
    index("vocabulary_user_idx").on(t.userId),
    index("vocabulary_updated_idx").on(t.userId, t.updatedAt),
  ],
);

export const badges = sqliteTable("badges", {
  id: idPk(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"),
  category: text("category"),
});

export const userBadges = sqliteTable(
  "user_badges",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    badgeId: text("badge_id")
      .notNull()
      .references(() => badges.id, { onDelete: "cascade" }),
    earnedAt: ts("earned_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.badgeId] })],
);

export const customShelves = sqliteTable(
  "custom_shelves",
  {
    id: idPk(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    isPublic: bool("is_public").notNull().default(false),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("custom_shelves_user_idx").on(t.userId)],
);

export const customShelfBooks = sqliteTable(
  "custom_shelf_books",
  {
    shelfId: text("shelf_id")
      .notNull()
      .references(() => customShelves.id, { onDelete: "cascade" }),
    bookId: text("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    addedAt: ts("added_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.shelfId, t.bookId] })],
);

export const userFavorites = sqliteTable(
  "user_favorites",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    bookId: text("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.bookId] })],
);

export const userBookTags = sqliteTable(
  "user_book_tags",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    bookId: text("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.bookId, t.tag] })],
);
