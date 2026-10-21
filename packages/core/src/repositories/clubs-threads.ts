import type { Db } from "../db";
import type { ClubPost, ClubThread } from "./clubs";
import { clubPosts, clubThreads } from "../schema";
import { and, desc, eq } from "drizzle-orm";

// -- Threads ----------------------------------------------------------------

export async function createThread(
  db: Db,
  clubId: string,
  authorId: string,
  input: {
    type?: string;
    title: string;
    bookId?: string;
    chapter?: string;
    hasSpoilers?: boolean;
    expiresAt?: number;
    isAiStarter?: boolean;
  },
): Promise<ClubThread> {
  const [row] = await db
    .insert(clubThreads)
    .values({
      clubId,
      authorId,
      type: input.type ?? "discussion",
      title: input.title,
      bookId: input.bookId ?? null,
      chapter: input.chapter ?? null,
      hasSpoilers: input.hasSpoilers ?? false,
      isAiStarter: input.isAiStarter ?? false,
      expiresAt: input.expiresAt != null ? new Date(input.expiresAt) : null,
    })
    .returning();
  return row;
}

export async function getThreadById(db: Db, id: string): Promise<ClubThread | null> {
  const [row] = await db.select().from(clubThreads).where(eq(clubThreads.id, id)).limit(1);
  return row ?? null;
}

export async function listThreads(db: Db, clubId: string, limit = 50): Promise<ClubThread[]> {
  return db
    .select()
    .from(clubThreads)
    .where(and(eq(clubThreads.clubId, clubId), eq(clubThreads.isRemoved, false)))
    .orderBy(desc(clubThreads.isPinned), desc(clubThreads.createdAt))
    .limit(limit);
}

export async function removeThread(
  db: Db,
  id: string,
  removedBy: string,
): Promise<ClubThread | null> {
  const [row] = await db
    .update(clubThreads)
    .set({ isRemoved: true, removedBy, removedAt: new Date() })
    .where(eq(clubThreads.id, id))
    .returning();
  return row ?? null;
}

// -- Posts ------------------------------------------------------------------

export async function createPost(
  db: Db,
  threadId: string,
  authorId: string,
  input: { content: string; parentPostId?: string; hasSpoiler?: boolean },
): Promise<ClubPost> {
  const [row] = await db
    .insert(clubPosts)
    .values({
      threadId,
      authorId,
      content: input.content,
      parentPostId: input.parentPostId ?? null,
      hasSpoiler: input.hasSpoiler ?? false,
    })
    .returning();
  return row;
}

export async function getPostById(db: Db, id: string): Promise<ClubPost | null> {
  const [row] = await db.select().from(clubPosts).where(eq(clubPosts.id, id)).limit(1);
  return row ?? null;
}

export async function listPosts(db: Db, threadId: string, limit = 200): Promise<ClubPost[]> {
  return db
    .select()
    .from(clubPosts)
    .where(and(eq(clubPosts.threadId, threadId), eq(clubPosts.isRemoved, false)))
    .orderBy(clubPosts.createdAt)
    .limit(limit);
}

export async function removePost(
  db: Db,
  id: string,
  removedBy: string,
  reason?: string,
): Promise<ClubPost | null> {
  const [row] = await db
    .update(clubPosts)
    .set({ isRemoved: true, removedBy, removedReason: reason ?? null, removedAt: new Date() })
    .where(eq(clubPosts.id, id))
    .returning();
  return row ?? null;
}
