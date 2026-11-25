// Stripe is the source of truth; profiles carries the projected tier/status (written only by the webhook). billing_events is the
// idempotency ledger: one row per event id, so a duplicate delivery is a no-op.
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createdAt } from "./_helpers";

export const billingEvents = sqliteTable("billing_events", {
  id: text("id").primaryKey(), // Stripe event id (evt_...)
  type: text("type").notNull(),
  createdAt: createdAt(),
});
