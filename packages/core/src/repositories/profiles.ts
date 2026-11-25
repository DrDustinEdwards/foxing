import { likeContains } from "@dustinedwards/site-runtime/d1";
// All profile data access goes through here so a tenancy layer can be added without touching call sites.
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { chunked, type Db } from "../db";
import { profiles } from "../schema";
import type { UpdateMeInput } from "../validators/profile";

export type Profile = typeof profiles.$inferSelect;
/** A signed-in reader's profile; `isAdmin` is the admin list's answer (isAdminEmail), never a stored column. */
export type SignedInProfile = Profile & { isAdmin: boolean };
export type NewProfile = typeof profiles.$inferInsert;

export type ProfileSummary = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export async function getProfileById(db: Db, userId: string): Promise<Profile | null> {
  const rows = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
  return rows[0] ?? null;
}

export async function getProfileByUsername(db: Db, username: string): Promise<Profile | null> {
  const rows = await db.select().from(profiles).where(eq(profiles.username, username)).limit(1);
  return rows[0] ?? null;
}

export async function getProfileSummaries(
  db: Db,
  ids: string[],
): Promise<Map<string, ProfileSummary>> {
  const map = new Map<string, ProfileSummary>();
  if (ids.length === 0) return map;
  for (const chunk of chunked([...new Set(ids)])) {
    const rows = await db
      .select({
        id: profiles.id,
        username: profiles.username,
        displayName: profiles.displayName,
        avatarUrl: profiles.avatarUrl,
      })
      .from(profiles)
      .where(inArray(profiles.id, chunk));
    for (const r of rows) map.set(r.id, r);
  }
  return map;
}

/** PUBLIC profiles only (null visibility defaults to public), so it is safe on the anonymous, edge-cached suggest endpoint. */
export async function searchProfiles(db: Db, query: string, limit = 4): Promise<ProfileSummary[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  return db
    .select({
      id: profiles.id,
      username: profiles.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
    })
    .from(profiles)
    .where(
      and(
        or(likeContains(profiles.username, q), likeContains(profiles.displayName, q)),
        sql`coalesce(json_extract(${profiles.visibility}, '$.profile'), 'public') = 'public'`,
      ),
    )
    .limit(limit);
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

/** Write only: callers check uniqueness first (getProfileByUsername). */
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

export async function setSubscriptionStatus(db: Db, userId: string, status: string): Promise<void> {
  await db
    .update(profiles)
    .set({ subscriptionStatus: status, updatedAt: new Date() })
    .where(eq(profiles.id, userId));
}

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

/** A plain replace like setNotificationPrefs: the client sends the full object. */
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
