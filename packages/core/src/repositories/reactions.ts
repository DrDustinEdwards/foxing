// Reactions data access (Phase 6). One generalized table replaces the old per-feature
// like tables. Phase 6 wires reading_list + diary_entry targets (list likes, review
// likes). Owner resolution (for the reaction notification) is done here so the domain
// can notify the target's author without knowing each table's shape.
import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../db";
import { diaryEntries, reactions, readingLists } from "../schema";

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

/** The owner (author) of a reaction target, so the domain can notify them. Returns null
 *  if the target does not exist or its type is not one Phase 6 supports notifying. */
export async function resolveTargetOwner(
  db: Db,
  targetType: string,
  targetId: string,
): Promise<string | null> {
  if (targetType === "reading_list") {
    const [row] = await db
      .select({ owner: readingLists.userId })
      .from(readingLists)
      .where(eq(readingLists.id, targetId))
      .limit(1);
    return row?.owner ?? null;
  }
  if (targetType === "diary_entry") {
    const [row] = await db
      .select({ owner: diaryEntries.userId })
      .from(diaryEntries)
      .where(eq(diaryEntries.id, targetId))
      .limit(1);
    return row?.owner ?? null;
  }
  return null;
}
