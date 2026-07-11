// Billing idempotency ledger (Phase 4b). Stripe retries webhooks, so the route records
// every event id once and treats a duplicate delivery as a no-op. The insert is the
// atomic guard: onConflictDoNothing returns nothing when the id already exists.
import { billingEvents } from "../schema";
import type { Db } from "../db";

/** Record a Stripe event id. Returns true if this delivery is new (should be processed),
 *  false if it was already recorded (duplicate retry, skip). */
export async function recordEventOnce(db: Db, id: string, type: string): Promise<boolean> {
  const rows = await db
    .insert(billingEvents)
    .values({ id, type })
    .onConflictDoNothing({ target: billingEvents.id })
    .returning({ id: billingEvents.id });
  return rows.length > 0;
}
