// One generalized reactions table. Owner resolution (for the reaction notification) is here so the domain can notify the target's author without knowing each table's shape.
import { and, eq, inArray, sql } from "drizzle-orm";
import { chunked, type Db } from "../db";
import { annotations, diaryEntries, reactions, readingLists } from "../schema";

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

/** The owner of a reaction target and who may see it; null when it does not exist or takes no reactions. */
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

export type LikeSummary = { likeCount: number; likedByMe: boolean };

/** Per-target 'like' counts plus whether the viewer liked each; a target with no likes is absent. One grouped read + one membership read, both chunked, so no query per annotation. */
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
