import type { Db } from "../db";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  notInArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { z } from "zod";
import { journalPostVersions, journalPosts, journalSlugRedirects } from "../schema";

// ---- Journal ------------------------------------------------------------------

export type JournalAdminQuery = {
  limit?: number;
  offset?: number;
  /** Published or not; omitted lists both. */
  published?: boolean;
  /** Matches the title, the body or the slug, case-insensitively. */
  q?: string;
  /** Carrying this tag. */
  tag?: string;
  /** First published at or after, and before. */
  publishedAfter?: Date;
  publishedBefore?: Date;
  /** true lists the trash alone; otherwise the trash is left out. */
  trashed?: boolean;
  /** Only these slugs, or all but these (Carrel's scheduled posts, from site-api's table). */
  slugs?: string[];
  exceptSlugs?: string[];
  /** The newest updated first unless given; titles A to Z by default. */
  sort?: "updated" | "published" | "title";
  dir?: "asc" | "desc";
};

function journalAdminWhere(query: JournalAdminQuery): SQL | undefined {
  const where: SQL[] = [
    query.trashed ? isNotNull(journalPosts.trashedAt) : isNull(journalPosts.trashedAt),
  ];
  if (query.published !== undefined) where.push(eq(journalPosts.isPublished, query.published));
  if (query.q) {
    const pattern = `%${query.q.toLowerCase()}%`;
    const match = or(
      like(sql`lower(${journalPosts.title})`, pattern),
      like(sql`lower(${journalPosts.content})`, pattern),
      like(journalPosts.slug, pattern),
    );
    if (match) where.push(match);
  }
  if (query.tag)
    where.push(
      sql`EXISTS (SELECT 1 FROM json_each(${journalPosts.tags}) WHERE lower(value) = ${query.tag.toLowerCase()})`,
    );
  if (query.publishedAfter) where.push(gte(journalPosts.publishedAt, query.publishedAfter));
  if (query.publishedBefore) where.push(lt(journalPosts.publishedAt, query.publishedBefore));
  if (query.slugs)
    where.push(query.slugs.length ? inArray(journalPosts.slug, query.slugs) : sql`0`);
  if (query.exceptSlugs?.length) where.push(notInArray(journalPosts.slug, query.exceptSlugs));
  return and(...where);
}

export async function listJournalAdmin(db: Db, query: JournalAdminQuery = {}) {
  const sort = query.sort ?? "updated";
  const dir = query.dir ?? (sort === "title" ? "asc" : "desc");
  const by = {
    updated: journalPosts.updatedAt,
    published: journalPosts.publishedAt,
    title: sql`lower(${journalPosts.title})`,
  }[sort];
  return db
    .select({
      id: journalPosts.id,
      title: journalPosts.title,
      slug: journalPosts.slug,
      excerpt: journalPosts.excerpt,
      isPublished: journalPosts.isPublished,
      featured: journalPosts.featured,
      publishedAt: journalPosts.publishedAt,
      updatedAt: journalPosts.updatedAt,
      trashedAt: journalPosts.trashedAt,
      tags: journalPosts.tags,
    })
    .from(journalPosts)
    .where(journalAdminWhere(query))
    .orderBy(dir === "asc" ? asc(by) : desc(by), desc(journalPosts.id))
    .limit(query.limit ?? 200)
    .offset(query.offset ?? 0);
}

export async function countJournalAdmin(db: Db, query: JournalAdminQuery = {}): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(journalPosts)
    .where(journalAdminWhere(query));
  return row?.n ?? 0;
}

export async function getJournalById(db: Db, id: string) {
  const [row] = await db.select().from(journalPosts).where(eq(journalPosts.id, id)).limit(1);
  return row ?? null;
}

export async function getJournalBySlug(db: Db, slug: string) {
  const [row] = await db.select().from(journalPosts).where(eq(journalPosts.slug, slug)).limit(1);
  return row ?? null;
}

/** A Journal post's rules, which Carrel's site API checks every save against (apps/web/app/lib/carrel). */
export const journalInput = z.object({
  title: z.string().min(1).max(500),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens."),
  content: z.string().min(1),
  excerpt: z.string().max(1000).nullable().optional(),
  coverImageUrl: z.string().url().max(1000).nullable().optional(),
  coverImageAlt: z.string().max(500).nullable().optional(),
  tags: z.array(z.string().max(60)).max(20).nullable().optional(),
  featured: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  // site-api's search fields, as Carrel sets them (apps/web/app/lib/carrel/journal-source.ts).
  ogTitle: z.string().max(500).nullable().optional(),
  ogDescription: z.string().max(1000).nullable().optional(),
  ogImageUrl: z.string().url().max(1000).nullable().optional(),
  ogImageAlt: z.string().max(500).nullable().optional(),
  canonicalUrl: z.string().url().max(1000).nullable().optional(),
  noindex: z.boolean().optional(),
});

export type JournalInput = z.infer<typeof journalInput>;

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
      ogTitle: input.ogTitle ?? null,
      ogDescription: input.ogDescription ?? null,
      ogImageUrl: input.ogImageUrl ?? null,
      ogImageAlt: input.ogImageAlt ?? null,
      canonicalUrl: input.canonicalUrl ?? null,
      noindex: input.noindex ?? false,
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
 * does not exist or the guard's updated_at is stale. `publishedAt`, where given, is the date the
 * post is published under, live before or not (Carrel's settable publish date).
 */
export async function setJournalPublished(
  db: Db,
  id: string,
  on: boolean,
  guard: JournalWriteGuard = {},
  options: { publishedAt?: Date } = {},
): Promise<boolean> {
  const current = await getJournalById(db, id);
  if (!current) return false;
  const updated = await db
    .update(journalPosts)
    .set({
      isPublished: on,
      // First publish stamps published_at; unpublishing keeps the original stamp.
      publishedAt:
        options.publishedAt ??
        (on && !current.publishedAt ? new Date() : (current.publishedAt ?? null)),
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

/**
 * Into the trash (trashed_at set) or back out of it. Either way the post is a draft: a trashed post
 * is off the Journal, and a restore never republishes. False, having written nothing, as above.
 */
export async function setJournalTrashed(
  db: Db,
  id: string,
  trashed: boolean,
  guard: JournalWriteGuard = {},
): Promise<boolean> {
  const current = await getJournalById(db, id);
  if (!current) return false;
  const updated = await db
    .update(journalPosts)
    .set({
      isPublished: false,
      trashedAt: trashed ? new Date() : null,
      updatedAt: nextUpdatedAt(current.updatedAt),
    })
    .where(journalRow(id, guard))
    .returning({ id: journalPosts.id });
  return updated.length > 0;
}

/**
 * Deletes a post for good, with its history and the redirects that led to it. The guarded delete
 * goes first, so a stale one removes nothing. False when it matched no row.
 */
export async function deleteJournalPost(
  db: Db,
  id: string,
  guard: JournalWriteGuard = {},
): Promise<boolean> {
  const [removed] = await db
    .delete(journalPosts)
    .where(journalRow(id, guard))
    .returning({ slug: journalPosts.slug });
  if (!removed) return false;
  await db.batch([
    db.delete(journalPostVersions).where(eq(journalPostVersions.postId, id)),
    db.delete(journalSlugRedirects).where(eq(journalSlugRedirects.toSlug, removed.slug)),
  ]);
  return true;
}

/**
 * Moves a post to a new slug, its address, as one batch. History is keyed by the post's id, so it
 * stays with it. With `redirect`, the old address answers a 301 to the new one, and every older
 * address that led to the old one now leads straight to the new one. A post renamed back to an
 * address it had answers it again. Every statement after the first runs only where that first one
 * moved the row (the slug and the new updated_at), so a stale rename writes nothing at all.
 * False when the guard was stale.
 */
export async function renameJournalPost(
  db: Db,
  id: string,
  newSlug: string,
  options: { redirect: boolean },
  guard: JournalWriteGuard = {},
): Promise<boolean> {
  const current = await getJournalById(db, id);
  if (!current) return false;
  const stamp = nextUpdatedAt(current.updatedAt);
  const moved = sql`EXISTS (SELECT 1 FROM journal_posts WHERE id = ${id} AND slug = ${newSlug} AND updated_at = ${stamp.getTime()})`;
  const redirects = [
    db
      .update(journalSlugRedirects)
      .set({ toSlug: newSlug })
      .where(and(eq(journalSlugRedirects.toSlug, current.slug), moved)),
    db
      .insert(journalSlugRedirects)
      .select(
        db
          .select({
            fromSlug: sql<string>`${current.slug}`.as("from_slug"),
            toSlug: sql<string>`${newSlug}`.as("to_slug"),
            createdAt: sql<Date>`${Date.now()}`.as("created_at"),
          })
          .from(journalPosts)
          .where(and(eq(journalPosts.id, id), moved)),
      )
      .onConflictDoUpdate({
        target: journalSlugRedirects.fromSlug,
        set: { toSlug: newSlug, createdAt: new Date() },
      }),
  ];
  await db.batch([
    db.update(journalPosts).set({ slug: newSlug, updatedAt: stamp }).where(journalRow(id, guard)),
    db.delete(journalSlugRedirects).where(and(eq(journalSlugRedirects.fromSlug, newSlug), moved)),
    ...(options.redirect ? redirects : []),
  ]);
  const after = await getJournalById(db, id);
  return after?.slug === newSlug && after.updatedAt.getTime() === stamp.getTime();
}
