// notifications are written only by core event handlers; admin_audit_log records every admin/operator write.
import { sqliteTable, text, index, primaryKey } from "drizzle-orm/sqlite-core";
import { bool, cascadeFk, createdAt, idPk, json, ts, updatedAt } from "./_helpers";
import { user } from "./auth";

export const notifications = sqliteTable(
  "notifications",
  {
    id: idPk(),
    userId: cascadeFk("user_id", () => user.id),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    data: json<Record<string, unknown>>("data"),
    isRead: bool("is_read").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index("notifications_user_idx").on(t.userId, t.isRead),
    index("notifications_created_idx").on(t.createdAt),
  ],
);

// An announcement is live when is_active AND now is within [starts_at, ends_at] (null bounds = open-ended).
export const announcements = sqliteTable(
  "announcements",
  {
    id: idPk(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    placement: text("placement").notNull().default("banner"), // banner | home | journal
    linkUrl: text("link_url"),
    linkLabel: text("link_label"),
    isActive: bool("is_active").notNull().default(false),
    startsAt: ts("starts_at"),
    endsAt: ts("ends_at"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("announcements_active_idx").on(t.isActive, t.placement)],
);

export const adminAuditLog = sqliteTable("admin_audit_log", {
  id: idPk(),
  action: text("action").notNull(),
  params: json<Record<string, unknown>>("params"),
  actor: text("actor"),
  sourceIp: text("source_ip"),
  performedAt: ts("performed_at").notNull(),
});

export const pushTokens = sqliteTable(
  "push_tokens",
  {
    userId: cascadeFk("user_id", () => user.id),
    token: text("token").notNull(),
    platform: text("platform").notNull(), // ios | android
    createdAt: createdAt(),
    lastSeenAt: ts("last_seen_at"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.token] })],
);
