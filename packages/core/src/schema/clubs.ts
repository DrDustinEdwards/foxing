// Clubs (10 tables, consolidated from 17). Invites are join_code links (no invite
// table); poll options + ballots are JSON (IRV computed in core); no denormalized
// counts. A club's current read may be a catalog OR community book.
import {
  integer,
  sqliteTable,
  text,
  index,
  primaryKey,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";
import { bool, createdAt, idPk, json, ts, updatedAt } from "./_helpers";
import { user } from "./auth";
import { books } from "./catalog";

type Bookstore = Record<string, unknown>; // absorbs the 7 bookstore_* cols + hours
type PollOption = { id: string; label: string; bookId?: string };

export const clubs = sqliteTable(
  "clubs",
  {
    id: idPk(),
    name: text("name").notNull(),
    slug: text("slug").unique(),
    description: text("description"),
    coverUrl: text("cover_url"),
    creatorId: text("creator_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    currentBookId: text("current_book_id").references(() => books.id, { onDelete: "set null" }),
    clubType: text("club_type").notNull().default("reader"), // reader | bookstore
    visibility: text("visibility").notNull().default("public"), // public | private
    memberApproval: bool("member_approval").notNull().default(false),
    maxMembers: integer("max_members"),
    readingPace: text("reading_pace"),
    chaptersPerWeek: integer("chapters_per_week"),
    genreTags: json<string[]>("genre_tags"),
    joinCode: text("join_code"), // replaces per-row invite codes
    bookstore: json<Bookstore>("bookstore"),
    isVerified: bool("is_verified").notNull().default(false),
    verifiedAt: ts("verified_at"),
    verifiedBy: text("verified_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("clubs_creator_idx").on(t.creatorId), index("clubs_join_code_idx").on(t.joinCode)],
);

export const clubMembers = sqliteTable(
  "club_members",
  {
    clubId: text("club_id")
      .notNull()
      .references(() => clubs.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("active"),
    role: text("role").notNull().default("member"),
    joinedAt: ts("joined_at"),
    invitedBy: text("invited_by").references(() => user.id, { onDelete: "set null" }),
    requestedAt: ts("requested_at"),
    bannedAt: ts("banned_at"),
    bannedBy: text("banned_by").references(() => user.id, { onDelete: "set null" }),
    banReason: text("ban_reason"),
    mutedUntil: ts("muted_until"),
    mutedBy: text("muted_by").references(() => user.id, { onDelete: "set null" }),
  },
  (t) => [
    primaryKey({ columns: [t.clubId, t.userId] }),
    index("club_members_user_idx").on(t.userId),
  ],
);

export const clubThreads = sqliteTable(
  "club_threads",
  {
    id: idPk(),
    clubId: text("club_id")
      .notNull()
      .references(() => clubs.id, { onDelete: "cascade" }),
    bookId: text("book_id").references(() => books.id, { onDelete: "set null" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("discussion"), // discussion | announcement
    title: text("title").notNull(),
    chapter: text("chapter"),
    isPinned: bool("is_pinned").notNull().default(false),
    isAiStarter: bool("is_ai_starter").notNull().default(false), // AI-generated ONLY
    hasSpoilers: bool("has_spoilers").notNull().default(false),
    expiresAt: ts("expires_at"),
    isRemoved: bool("is_removed").notNull().default(false),
    removedBy: text("removed_by").references(() => user.id, { onDelete: "set null" }),
    removedAt: ts("removed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("club_threads_club_idx").on(t.clubId)],
);

export const clubPosts = sqliteTable(
  "club_posts",
  {
    id: idPk(),
    threadId: text("thread_id")
      .notNull()
      .references(() => clubThreads.id, { onDelete: "cascade" }),
    parentPostId: text("parent_post_id").references((): AnySQLiteColumn => clubPosts.id, {
      onDelete: "cascade",
    }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    hasSpoiler: bool("has_spoiler").notNull().default(false),
    isEdited: bool("is_edited").notNull().default(false),
    isPinned: bool("is_pinned").notNull().default(false),
    isRemoved: bool("is_removed").notNull().default(false),
    removedAt: ts("removed_at"),
    removedBy: text("removed_by").references(() => user.id, { onDelete: "set null" }),
    removedReason: text("removed_reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("club_posts_thread_idx").on(t.threadId)],
);

export const clubPolls = sqliteTable(
  "club_polls",
  {
    id: idPk(),
    clubId: text("club_id")
      .notNull()
      .references(() => clubs.id, { onDelete: "cascade" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    pollType: text("poll_type").notNull().default("single"), // single | irv
    options: json<PollOption[]>("options").notNull(),
    closesAt: ts("closes_at"),
    isClosed: bool("is_closed").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("club_polls_club_idx").on(t.clubId)],
);

export const clubPollVotes = sqliteTable(
  "club_poll_votes",
  {
    pollId: text("poll_id")
      .notNull()
      .references(() => clubPolls.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ranks: json<string[]>("ranks").notNull(), // ordered option ids; single-choice = length 1
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.pollId, t.userId] })],
);

export const clubMeetings = sqliteTable(
  "club_meetings",
  {
    id: idPk(),
    clubId: text("club_id")
      .notNull()
      .references(() => clubs.id, { onDelete: "cascade" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    bookId: text("book_id").references(() => books.id, { onDelete: "set null" }),
    meetingDate: ts("meeting_date").notNull(),
    endDate: ts("end_date"),
    meetingType: text("meeting_type").notNull().default("virtual"),
    locationName: text("location_name"),
    locationAddress: text("location_address"),
    locationUrl: text("location_url"),
    isRecurring: bool("is_recurring").notNull().default(false),
    recurrenceRule: text("recurrence_rule"),
    rsvpLimit: integer("rsvp_limit"),
    isCancelled: bool("is_cancelled").notNull().default(false),
    cancelledAt: ts("cancelled_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("club_meetings_club_idx").on(t.clubId)],
);

export const clubMeetingRsvps = sqliteTable(
  "club_meeting_rsvps",
  {
    meetingId: text("meeting_id")
      .notNull()
      .references(() => clubMeetings.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.meetingId, t.userId] })],
);

export const clubSchedule = sqliteTable(
  "club_schedule",
  {
    id: idPk(),
    clubId: text("club_id")
      .notNull()
      .references(() => clubs.id, { onDelete: "cascade" }),
    chapterName: text("chapter_name").notNull(),
    unlockDate: ts("unlock_date").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("club_schedule_club_idx").on(t.clubId)],
);

export const clubBooks = sqliteTable(
  "club_books",
  {
    id: idPk(),
    clubId: text("club_id")
      .notNull()
      .references(() => clubs.id, { onDelete: "cascade" }),
    bookId: text("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    startedAt: ts("started_at"),
    finishedAt: ts("finished_at"),
    isCurrent: bool("is_current").notNull().default(false),
  },
  (t) => [index("club_books_club_idx").on(t.clubId)],
);
