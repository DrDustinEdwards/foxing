import type { Db } from "../db";
import { and, desc, eq, like, or, sql, type SQL } from "drizzle-orm";
import { journalPosts, journalPostVersions } from "../schema";

// ---- Journal ------------------------------------------------------------------

export type JournalAdminQuery = {
  limit?: number;
  offset?: number;
  /** Published or not; omitted lists both. */
  published?: boolean;
  /** Matches title or slug, case-insensitively. */
  q?: string;
};

export async function listJournalAdmin(db: Db, query: JournalAdminQuery = {}) {
  const where: SQL[] = [];
  if (query.published !== undefined) where.push(eq(journalPosts.isPublished, query.published));
  if (query.q) {
    const pattern = `%${query.q.toLowerCase()}%`;
    const match = or(
      like(sql`lower(${journalPosts.title})`, pattern),
      like(journalPosts.slug, pattern),
    );
    if (match) where.push(match);
  }
  return db
    .select({
      id: journalPosts.id,
      title: journalPosts.title,
      slug: journalPosts.slug,
      isPublished: journalPosts.isPublished,
      featured: journalPosts.featured,
      publishedAt: journalPosts.publishedAt,
      updatedAt: journalPosts.updatedAt,
      tags: journalPosts.tags,
    })
    .from(journalPosts)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(journalPosts.updatedAt), desc(journalPosts.id))
    .limit(query.limit ?? 200)
    .offset(query.offset ?? 0);
}

export async function getJournalById(db: Db, id: string) {
  const [row] = await db.select().from(journalPosts).where(eq(journalPosts.id, id)).limit(1);
  return row ?? null;
}

export async function getJournalBySlug(db: Db, slug: string) {
  const [row] = await db.select().from(journalPosts).where(eq(journalPosts.slug, slug)).limit(1);
  return row ?? null;
}

export type JournalInput = {
  title: string;
  slug: string;
  content: string;
  excerpt?: string | null;
  coverImageUrl?: string | null;
  coverImageAlt?: string | null;
  tags?: string[] | null;
  featured?: boolean;
  isPublished?: boolean;
};

/** Optimistic concurrency for a journal write: the write lands only while updated_at still holds this. */
export type JournalWriteGuard = { expectedUpdatedAt?: Date };

/**
 * The updated_at a write stamps: now, but always past the stored one, so two writes in the same
 * millisecond still leave different versions and a stale expectedUpdatedAt can never match again.
 */
function nextUpdatedAt(stored: Date | null | undefined): Date {
  const now = Date.now();
  return new Date(stored ? Math.max(now, stored.getTime() + 1) : now);
}

function journalRow(id: string, guard: JournalWriteGuard): SQL {
  const byId = eq(journalPosts.id, id);
  if (!guard.expectedUpdatedAt) return byId;
  return and(byId, eq(journalPosts.updatedAt, guard.expectedUpdatedAt)) as SQL;
}

/** authorId is null for a post created outside a user session (the Carrel site API). */
export async function createJournalPost(
  db: Db,
  input: JournalInput,
  authorId: string | null,
): Promise<string> {
  const published = input.isPublished ?? false;
  const [row] = await db
    .insert(journalPosts)
    .values({
      title: input.title,
      slug: input.slug,
      content: input.content,
      excerpt: input.excerpt ?? null,
      coverImageUrl: input.coverImageUrl ?? null,
      coverImageAlt: input.coverImageAlt ?? null,
      tags: input.tags ?? null,
      featured: input.featured ?? false,
      authorId,
      isPublished: published,
      publishedAt: published ? new Date() : null,
    })
    .returning({ id: journalPosts.id });
  return row.id;
}

/**
 * Saves a journal post, snapshotting the text it replaces into journal_post_versions first.
 * savedBy is null for a save made outside a user session (the Carrel site API). Returns false,
 * having written nothing, when the post does not exist or the guard's updated_at is stale.
 */
export async function updateJournalPost(
  db: Db,
  id: string,
  input: Partial<JournalInput>,
  savedBy: string | null,
  guard: JournalWriteGuard = {},
): Promise<boolean> {
  const current = await getJournalById(db, id);
  if (!current) return false;
  if (
    guard.expectedUpdatedAt &&
    current.updatedAt.getTime() !== guard.expectedUpdatedAt.getTime()
  ) {
    return false;
  }
  // Snapshot the current version before overwriting, mirroring the legacy version history.
  const [snapshot] = await db
    .insert(journalPostVersions)
    .values({
      postId: id,
      title: current.title,
      content: current.content,
      excerpt: current.excerpt,
      savedAt: new Date(),
      savedBy,
    })
    .returning({ id: journalPostVersions.id });
  const updated = await db
    .update(journalPosts)
    .set({ ...input, updatedAt: nextUpdatedAt(current.updatedAt) })
    .where(journalRow(id, guard))
    .returning({ id: journalPosts.id });
  if (updated.length === 0) {
    // Another write landed between the read and this one: the snapshot describes nothing.
    await db.delete(journalPostVersions).where(eq(journalPostVersions.id, snapshot.id));
    return false;
  }
  return true;
}

/**
 * Publishes or unpublishes a journal post. Returns false, having written nothing, when the post
 * does not exist or the guard's updated_at is stale.
 */
export async function setJournalPublished(
  db: Db,
  id: string,
  on: boolean,
  guard: JournalWriteGuard = {},
): Promise<boolean> {
  const current = await getJournalById(db, id);
  if (!current) return false;
  const updated = await db
    .update(journalPosts)
    .set({
      isPublished: on,
      // First publish stamps published_at; unpublishing keeps the original stamp.
      publishedAt: on && !current.publishedAt ? new Date() : (current.publishedAt ?? null),
      updatedAt: nextUpdatedAt(current.updatedAt),
    })
    .where(journalRow(id, guard))
    .returning({ id: journalPosts.id });
  return updated.length > 0;
}

/** The text a post held before each save, newest first. */
export async function listJournalVersions(db: Db, postId: string, limit = 50) {
  return db
    .select()
    .from(journalPostVersions)
    .where(eq(journalPostVersions.postId, postId))
    .orderBy(desc(journalPostVersions.savedAt), desc(journalPostVersions.id))
    .limit(limit);
}

export async function getJournalVersion(db: Db, postId: string, versionId: string) {
  const [row] = await db
    .select()
    .from(journalPostVersions)
    .where(and(eq(journalPostVersions.postId, postId), eq(journalPostVersions.id, versionId)))
    .limit(1);
  return row ?? null;
}
