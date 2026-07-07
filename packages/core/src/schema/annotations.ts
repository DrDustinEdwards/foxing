// Annotations layer (3 tables). Replaces highlights, bookmarks, passage_comments,
// commonplace_book, and every like/reaction/save table. Extension point for the
// future Edu class layer (the visibility enum grows a 'class' value there).
import {
  sqliteTable,
  text,
  index,
  primaryKey,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";
import { bool, createdAt, idPk, json, updatedAt } from "./_helpers";
import { user } from "./auth";
import { books } from "./catalog";
import { clubs } from "./clubs";

type Locator = Record<string, unknown>;

export const annotations = sqliteTable(
  "annotations",
  {
    id: idPk(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // nullable: commonplace entries can come from outside the catalog.
    bookId: text("book_id").references(() => books.id, { onDelete: "cascade" }),
    // set for club passage comments.
    clubId: text("club_id").references(() => clubs.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // highlight | note | bookmark | comment | commonplace
    locator: json<Locator>("locator"), // Readium Locator; null for external commonplace
    selectedText: text("selected_text"),
    normalizedText: text("normalized_text"), // computed on write; popular-highlights key
    body: text("body"), // note/comment content
    color: text("color"), // 7 semantic colors, highlight only
    chapter: text("chapter"),
    sourceTitle: text("source_title"), // external commonplace
    visibility: text("visibility").notNull().default("private"), // private | friends | club | public
    containsSpoilers: bool("contains_spoilers").notNull().default(false),
    isPinned: bool("is_pinned").notNull().default(false),
    parentId: text("parent_id").references((): AnySQLiteColumn => annotations.id, {
      onDelete: "cascade",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("annotations_user_book_idx").on(t.userId, t.bookId),
    // popular highlights: distinct users per normalized_text where visibility=public.
    index("annotations_popular_idx").on(t.bookId, t.type, t.visibility, t.normalizedText),
    index("annotations_club_book_idx").on(t.clubId, t.bookId),
    index("annotations_parent_idx").on(t.parentId),
    index("annotations_updated_idx").on(t.updatedAt),
  ],
);

// Named reactions only; kind is 'like' or a named reaction (no emoji in UI chrome).
export const reactions = sqliteTable(
  "reactions",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    kind: text("kind").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.targetType, t.targetId, t.kind] }),
    index("reactions_target_idx").on(t.targetType, t.targetId),
  ],
);

export const saves = sqliteTable(
  "saves",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.targetType, t.targetId] })],
);
