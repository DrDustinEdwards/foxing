// Reactions data access. One generalized table replaces the old per-feature
// like tables. Phase 6 wires reading_list + diary_entry targets (list likes, review
// likes). Owner resolution (for the reaction notification) is done here so the domain
// can notify the target's author without knowing each table's shape.
import { and, eq, inArray, sql } from "drizzle-orm";
import { chunked, type Db } from "../db";
import { alias } from "drizzle-orm/sqlite-core";
import {
  annotations,
  clubMembers,
  closeFriends,
  diaryEntries,
  reactions,
  readingLists,
} from "../schema";

export type Reaction = typeof reactions.$inferSelect;

export async function addReaction(
  db: Db,
  userId: string,
  targetType: string,
  targetId: string,
  kind: string,
): Promise<void> {
  await db.insert(reactions).values({ userId, targetType, targetId, kind }).onConflictDoNothing();
}

export async function removeReaction(
  db: Db,
  userId: string,
  targetType: string,
  targetId: string,
  kind: string,
): Promise<void> {
  await db
    .delete(reactions)
    .where(
      and(
        eq(reactions.userId, userId),
        eq(reactions.targetType, targetType),
        eq(reactions.targetId, targetId),
        eq(reactions.kind, kind),
      ),
    );
}

export async function countReactions(
  db: Db,
  targetType: string,
  targetId: string,
  kind: string,
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(reactions)
    .where(
      and(
        eq(reactions.targetType, targetType),
        eq(reactions.targetId, targetId),
        eq(reactions.kind, kind),
      ),
    );
  return row?.n ?? 0;
}

export async function hasReacted(
  db: Db,
  userId: string,
  targetType: string,
  targetId: string,
  kind: string,
): Promise<boolean> {
  const [row] = await db
    .select({ x: sql<number>`1` })
    .from(reactions)
    .where(
      and(
        eq(reactions.userId, userId),
        eq(reactions.targetType, targetType),
        eq(reactions.targetId, targetId),
        eq(reactions.kind, kind),
      ),
    )
    .limit(1);
  return !!row;
}

/** The owner of a reaction target and who may see it, so the domain can notify the owner
 *  and refuse a reaction on something the actor cannot read. Null when the target does not
 *  exist or is not a type that takes reactions. */
export async function resolveTarget(
  db: Db,
  targetType: string,
  targetId: string,
): Promise<{ owner: string; visibility: string } | null> {
  if (targetType === "reading_list") {
    const [row] = await db
      .select({ owner: readingLists.userId, isPublic: readingLists.isPublic })
      .from(readingLists)
      .where(eq(readingLists.id, targetId))
      .limit(1);
    return row ? { owner: row.owner, visibility: row.isPublic ? "public" : "private" } : null;
  }
  const table =
    targetType === "diary_entry" ? diaryEntries : targetType === "annotation" ? annotations : null;
  if (!table) return null;
  const [row] = await db
    .select({ owner: table.userId, visibility: table.visibility })
    .from(table)
    .where(eq(table.id, targetId))
    .limit(1);
  return row ?? null;
}

/** True when the viewer is one of the owner's close friends. */
export async function isCloseFriendOf(db: Db, ownerId: string, viewerId: string): Promise<boolean> {
  const [row] = await db
    .select({ x: sql<number>`1` })
    .from(closeFriends)
    .where(and(eq(closeFriends.userId, ownerId), eq(closeFriends.friendId, viewerId)))
    .limit(1);
  return !!row;
}

/** True when both users are active members of one club. */
export async function shareActiveClub(db: Db, a: string, b: string): Promise<boolean> {
  const other = alias(clubMembers, "other");
  const [row] = await db
    .select({ x: sql<number>`1` })
    .from(clubMembers)
    .innerJoin(other, eq(other.clubId, clubMembers.clubId))
    .where(
      and(
        eq(clubMembers.userId, a),
        eq(other.userId, b),
        eq(clubMembers.status, "active"),
        eq(other.status, "active"),
      ),
    )
    .limit(1);
  return !!row;
}

export type LikeSummary = { likeCount: number; likedByMe: boolean };

/** Per-target 'like' counts plus whether the viewer liked each, for a set of targets of
 *  one type (e.g. the reader's others' annotations). Returns a map keyed by target id;
 *  a target with no likes is simply absent. One grouped read + one membership read, both
 *  chunked, so the reader popover never issues a query per annotation. */
export async function likeSummary(
  db: Db,
  targetType: string,
  targetIds: string[],
  viewerId: string | null,
): Promise<Map<string, LikeSummary>> {
  const out = new Map<string, LikeSummary>();
  if (targetIds.length === 0) return out;

  for (const chunk of chunked(targetIds)) {
    const counts = await db
      .select({ targetId: reactions.targetId, n: sql<number>`count(*)` })
      .from(reactions)
      .where(
        and(
          eq(reactions.targetType, targetType),
          eq(reactions.kind, "like"),
          inArray(reactions.targetId, chunk),
        ),
      )
      .groupBy(reactions.targetId);
    for (const r of counts) out.set(r.targetId, { likeCount: Number(r.n), likedByMe: false });
  }

  if (viewerId) {
    for (const chunk of chunked(targetIds)) {
      const mine = await db
        .select({ targetId: reactions.targetId })
        .from(reactions)
        .where(
          and(
            eq(reactions.targetType, targetType),
            eq(reactions.kind, "like"),
            eq(reactions.userId, viewerId),
            inArray(reactions.targetId, chunk),
          ),
        );
      for (const r of mine) {
        const cur = out.get(r.targetId) ?? { likeCount: 0, likedByMe: false };
        out.set(r.targetId, { ...cur, likedByMe: true });
      }
    }
  }

  return out;
}
