// Stripe retries webhooks: the insert is the atomic guard (onConflictDoNothing returns nothing when the id exists), so a duplicate delivery is a no-op.
import { eq } from "drizzle-orm";
import { billingEvents } from "../schema";
import type { Db } from "../db";

export async function recordEventOnce(db: Db, id: string, type: string): Promise<boolean> {
  const rows = await db
    .insert(billingEvents)
    .values({ id, type })
    .onConflictDoNothing({ target: billingEvents.id })
    .returning({ id: billingEvents.id });
  return rows.length > 0;
}

/** Removes a recorded id after processing failed, so Stripe's retry is processed instead of acked as a duplicate. */
export async function forgetEvent(db: Db, id: string): Promise<void> {
  await db.delete(billingEvents).where(eq(billingEvents.id, id));
}
