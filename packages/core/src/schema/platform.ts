// Platform (3 tables) + push_tokens (Phase 7). notifications written only by core
// event handlers. admin_audit_log records every admin/operator write.
import { sqliteTable, text, index, primaryKey } from "drizzle-orm/sqlite-core";
import { bool, createdAt, idPk, json, ts } from "./_helpers";
import { user } from "./auth";

export const notifications = sqliteTable(
  "notifications",
  {
    id: idPk(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    data: json<Record<string, unknown>>("data"),
    isRead: bool("is_read").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.isRead)],
);

export const reports = sqliteTable(
  "reports",
  {
    id: idPk(),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("open"),
    reviewedBy: text("reviewed_by").references(() => user.id, { onDelete: "set null" }),
    reviewedAt: ts("reviewed_at"),
    createdAt: createdAt(),
  },
  (t) => [index("reports_status_idx").on(t.status)],
);

export const adminAuditLog = sqliteTable("admin_audit_log", {
  id: idPk(),
  action: text("action").notNull(),
  params: json<Record<string, unknown>>("params"),
  actor: text("actor"),
  sourceIp: text("source_ip"),
  performedAt: ts("performed_at").notNull(),
});

// Phase 7. PK (user_id, token).
export const pushTokens = sqliteTable(
  "push_tokens",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    platform: text("platform").notNull(), // ios | android
    createdAt: createdAt(),
    lastSeenAt: ts("last_seen_at"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.token] })],
);
