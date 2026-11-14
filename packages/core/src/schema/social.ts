// Social (5 tables). activity_events is written ONLY by the core event emitter on
// API write paths, which fixes web/mobile feed parity by construction.
import { integer, sqliteTable, text, index, primaryKey } from "drizzle-orm/sqlite-core";
import { bool, cascadeFk, createdAt, idPk, ts, updatedAt } from "./_helpers";
import { user } from "./auth";
import { books } from "./catalog";

export const follows = sqliteTable(
  "follows",
  {
    followerId: cascadeFk("follower_id", () => user.id),
    followingId: cascadeFk("following_id", () => user.id),
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
    userId: cascadeFk("user_id", () => user.id),
    friendId: cascadeFk("friend_id", () => user.id),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.friendId] })],
);

export const readingLists = sqliteTable(
  "reading_lists",
  {
    id: idPk(),
    userId: cascadeFk("user_id", () => user.id),
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
    listId: cascadeFk("list_id", () => readingLists.id),
    bookId: cascadeFk("book_id", () => books.id),
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
    userId: cascadeFk("user_id", () => user.id),
    type: text("type").notNull(),
    bookId: text("book_id").references(() => books.id, { onDelete: "set null" }),
    targetId: text("target_id"),
    data: text("data", { mode: "json" }).notNull(),
    visibility: text("visibility").notNull().default("public"),
    createdAt: createdAt(),
  },
  (t) => [index("activity_user_idx").on(t.userId), index("activity_created_idx").on(t.createdAt)],
);
