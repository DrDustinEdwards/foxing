// Social (5 tables). activity_events is written ONLY by the core event emitter on
// API write paths, which fixes web/mobile feed parity by construction.
import { integer, sqliteTable, text, index, primaryKey } from "drizzle-orm/sqlite-core";
import { bool, createdAt, idPk, ts, updatedAt } from "./_helpers";
import { user } from "./auth";
import { books } from "./catalog";

export const follows = sqliteTable(
  "follows",
  {
    followerId: text("follower_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    followingId: text("following_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followingId] }),
    index("follows_following_idx").on(t.followingId),
  ],
);

export const closeFriends = sqliteTable(
  "close_friends",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    friendId: text("friend_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.friendId] })],
);

export const readingLists = sqliteTable(
  "reading_lists",
  {
    id: idPk(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    slug: text("slug"),
    description: text("description"),
    coverUrl: text("cover_url"),
    isPublic: bool("is_public").notNull().default(false),
    isFeatured: bool("is_featured").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("reading_lists_user_idx").on(t.userId)],
);

export const readingListBooks = sqliteTable(
  "reading_list_books",
  {
    id: idPk(),
    listId: text("list_id")
      .notNull()
      .references(() => readingLists.id, { onDelete: "cascade" }),
    bookId: text("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    note: text("note"),
    addedAt: ts("added_at"),
  },
  (t) => [index("reading_list_books_list_idx").on(t.listId)],
);

export const activityEvents = sqliteTable(
  "activity_events",
  {
    id: idPk(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    bookId: text("book_id").references(() => books.id, { onDelete: "set null" }),
    targetId: text("target_id"),
    data: text("data", { mode: "json" }).notNull(),
    visibility: text("visibility").notNull().default("public"),
    createdAt: createdAt(),
  },
  (t) => [index("activity_user_idx").on(t.userId), index("activity_created_idx").on(t.createdAt)],
);
