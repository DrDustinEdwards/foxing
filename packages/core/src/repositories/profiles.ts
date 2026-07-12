// Profiles repository. All profile data access goes through here so an org/classroom
// tenancy layer (Foxing Edu) can be added later without touching call sites.
import { eq, inArray } from "drizzle-orm";
import type { Db } from "../db";
import { profiles } from "../schema";
import type { UpdateMeInput } from "../validators/profile";

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;

/** Minimal identity for rendering an actor in a feed / follower list. */
export type ProfileSummary = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

/** Public projection of a profile, honoring the owner's visibility later. */
export type PublicProfile = Pick<
  Profile,
  "username" | "displayName" | "avatarUrl" | "backdropUrl" | "bio" | "favoriteGenres" | "createdAt"
>;

export async function getProfileById(db: Db, userId: string): Promise<Profile | null> {
  const rows = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
  return rows[0] ?? null;
}

export async function getProfileByUsername(db: Db, username: string): Promise<Profile | null> {
  const rows = await db.select().from(profiles).where(eq(profiles.username, username)).limit(1);
  return rows[0] ?? null;
}

/** Batch identity lookup for a set of user ids, keyed by id. Users without a profile
 *  row are simply absent from the map. */
export async function getProfileSummaries(
  db: Db,
  ids: string[],
): Promise<Map<string, ProfileSummary>> {
  const map = new Map<string, ProfileSummary>();
  if (ids.length === 0) return map;
  const rows = await db
    .select({
      id: profiles.id,
      username: profiles.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
    })
    .from(profiles)
    .where(inArray(profiles.id, ids));
  for (const r of rows) map.set(r.id, r);
  return map;
}

export async function createProfile(db: Db, values: NewProfile): Promise<Profile> {
  const [row] = await db.insert(profiles).values(values).returning();
  return row;
}

export async function updateProfile(
  db: Db,
  userId: string,
  patch: UpdateMeInput,
): Promise<Profile | null> {
  const [row] = await db
    .update(profiles)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(profiles.id, userId))
    .returning();
  return row ?? null;
}

/** Change the username. Callers must check uniqueness first (getProfileByUsername);
 *  this is the write only. Format is validated at the API boundary. */
export async function updateUsername(
  db: Db,
  userId: string,
  username: string,
): Promise<Profile | null> {
  const [row] = await db
    .update(profiles)
    .set({ username, updatedAt: new Date() })
    .where(eq(profiles.id, userId))
    .returning();
  return row ?? null;
}

// --- Billing (Phase 4b). The Stripe webhook is the only writer of these fields. ---

export async function getProfileByStripeCustomerId(
  db: Db,
  stripeCustomerId: string,
): Promise<Profile | null> {
  const rows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.stripeCustomerId, stripeCustomerId))
    .limit(1);
  return rows[0] ?? null;
}

/** Link a Foxing user to its Stripe customer (from checkout.session.completed). */
export async function setStripeCustomerId(
  db: Db,
  userId: string,
  stripeCustomerId: string,
): Promise<void> {
  await db
    .update(profiles)
    .set({ stripeCustomerId, updatedAt: new Date() })
    .where(eq(profiles.id, userId));
}

export type SubscriptionState = {
  tier: "free" | "plus";
  status: string;
  periodEnd: Date | null;
};

/** Project the subscription onto the profile: tier + status + renewal/trial end. */
export async function setSubscriptionState(
  db: Db,
  userId: string,
  state: SubscriptionState,
): Promise<void> {
  await db
    .update(profiles)
    .set({
      subscriptionTier: state.tier,
      subscriptionStatus: state.status,
      subscriptionPeriodEnd: state.periodEnd,
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, userId));
}

/** Record the dunning status (invoice.payment_failed) without changing tier. */
export async function setSubscriptionStatus(
  db: Db,
  userId: string,
  status: string,
): Promise<void> {
  await db
    .update(profiles)
    .set({ subscriptionStatus: status, updatedAt: new Date() })
    .where(eq(profiles.id, userId));
}

/** Set the notification_prefs json (Phase 7 push/in-app category + quiet-hours prefs). */
export async function setNotificationPrefs(
  db: Db,
  userId: string,
  prefs: Profile["notificationPrefs"],
): Promise<void> {
  await db
    .update(profiles)
    .set({ notificationPrefs: prefs, updatedAt: new Date() })
    .where(eq(profiles.id, userId));
}

/** Set the visibility json (profile / progress / default-annotation prefs). The client
 *  sends the full object, so this is a plain replace like setNotificationPrefs. */
export async function setVisibilityPrefs(
  db: Db,
  userId: string,
  prefs: Profile["visibility"],
): Promise<void> {
  await db
    .update(profiles)
    .set({ visibility: prefs, updatedAt: new Date() })
    .where(eq(profiles.id, userId));
}

export function toPublicProfile(p: Profile): PublicProfile {
  return {
    username: p.username,
    displayName: p.displayName,
    avatarUrl: p.avatarUrl,
    backdropUrl: p.backdropUrl,
    bio: p.bio,
    favoriteGenres: p.favoriteGenres,
    createdAt: p.createdAt,
  };
}
