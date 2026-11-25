import { and, eq } from "drizzle-orm";
import { inList } from "@dustinedwards/site-runtime/d1";
import type { Db } from "../db";
import type { NotificationPrefs } from "../domain/push";
import { notifications, profiles, pushTokens } from "../schema";

export type PushToken = typeof pushTokens.$inferSelect;

export async function registerToken(
  db: Db,
  userId: string,
  token: string,
  platform: string,
): Promise<void> {
  await db
    .insert(pushTokens)
    .values({ userId, token, platform, lastSeenAt: new Date() })
    .onConflictDoUpdate({
      target: [pushTokens.userId, pushTokens.token],
      set: { platform, lastSeenAt: new Date() },
    });
}

export async function deleteToken(db: Db, userId: string, token: string): Promise<void> {
  await db
    .delete(pushTokens)
    .where(and(eq(pushTokens.userId, userId), eq(pushTokens.token, token)));
}

export async function listTokens(db: Db, userId: string): Promise<PushToken[]> {
  return db.select().from(pushTokens).where(eq(pushTokens.userId, userId));
}

/** Keyed by token alone: a dead token is dead for whichever user owned it. */
export async function pruneTokens(db: Db, tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  // One statement, the list bound as one JSON parameter: no ceiling, and the prune stays atomic.
  await db.delete(pushTokens).where(inList(pushTokens.token, tokens));
}

export type DeliveryContext = {
  notification: typeof notifications.$inferSelect;
  timezone: string | null;
  prefs: NotificationPrefs | null;
  tokens: PushToken[];
} | null;

export async function loadDeliveryContext(
  db: Db,
  notificationId: string,
): Promise<DeliveryContext> {
  const [notification] = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, notificationId))
    .limit(1);
  if (!notification) return null;

  const [profile] = await db
    .select({ timezone: profiles.timezone, prefs: profiles.notificationPrefs })
    .from(profiles)
    .where(eq(profiles.id, notification.userId))
    .limit(1);
  if (!profile) return null;

  const tokens = await listTokens(db, notification.userId);
  return {
    notification,
    timezone: profile.timezone,
    prefs: (profile.prefs as NotificationPrefs | null) ?? null,
    tokens,
  };
}
