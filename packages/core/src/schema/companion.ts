// AI companion history (2 tables, Phase 4). Per-book conversation threads, and the daily usage counter.
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createdAt, idPk } from "./_helpers";
import { user } from "./auth";
import { books } from "./catalog";

export const companionThreads = sqliteTable(
  "companion_threads",
  {
    id: idPk(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    bookId: text("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    mode: text("mode"),
    createdAt: createdAt(),
  },
  (t) => [index("companion_threads_user_book_idx").on(t.userId, t.bookId)],
);

export const companionMessages = sqliteTable(
  "companion_messages",
  {
    id: idPk(),
    threadId: text("thread_id")
      .notNull()
      .references(() => companionThreads.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // user | assistant
    action: text("action"),
    content: text("content").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("companion_messages_thread_idx").on(t.threadId)],
);

// One row per reader per UTC day: the companion quota (security-open-items.md item 4). Written only by
// companionRepo.reserveUsage/settleUsage, each one statement, so parallel requests cannot all pass the cap
// on the same reading (migration 0022).
export const companionUsage = sqliteTable(
  "companion_usage",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    day: text("day").notNull(), // YYYYMMDD, UTC
    costCents: integer("cost_cents").notNull().default(0),
    requests: integer("requests").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })],
);
