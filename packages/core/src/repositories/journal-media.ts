// The Journal's media index (schema/journal-media.ts): the rows behind Carrel's library, which
// site-api's mediaLibrary runs (apps/web/app/lib/carrel/journal-media-adapter.server.ts), and the
// reads the Journal's pages make. Every metadata write names the rev it was loaded at and is
// checked in the same statement, so a stale write is refused and never lost. "Used by" is the
// Journal's own text: a post uses a file when its cover_image_url or its markdown names the
// file's address (/media/<key>).
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../db";
import { chunked } from "../db";
import { journalMedia, journalMediaChanges, journalMediaRevisions, journalPosts } from "../schema";

export type JournalMediaRow = typeof journalMedia.$inferSelect;
export type JournalMediaRevision = typeof journalMediaRevisions.$inferSelect;

/** Where every file is served, before its key: what a post's text names when it uses one. */
export const JOURNAL_MEDIA_PATH = "/media/";

/** The post names the file in this row in its cover, or in its body. */
const inCover = sql<number>`instr(coalesce(${journalPosts.coverImageUrl}, ''), ${JOURNAL_MEDIA_PATH} || ${journalMedia.key}) > 0`;
const inBody = sql<number>`instr(${journalPosts.content}, ${JOURNAL_MEDIA_PATH} || ${journalMedia.key}) > 0`;
const named = sql`(${inCover} OR ${inBody})`;

export async function getJournalMedia(db: Db, key: string): Promise<JournalMediaRow | null> {
  const [row] = await db.select().from(journalMedia).where(eq(journalMedia.key, key)).limit(1);
  return row ?? null;
}

/** The rows for these keys, in no particular order; absent keys are left out. */
export async function getJournalMediaMany(db: Db, keys: string[]): Promise<JournalMediaRow[]> {
  const rows: JournalMediaRow[] = [];
  for (const part of chunked(keys)) {
    rows.push(...(await db.select().from(journalMedia).where(inArray(journalMedia.key, part))));
  }
  return rows;
}

/** Every file, trashed included: the library filters and sorts them itself. */
export async function allJournalMedia(db: Db): Promise<JournalMediaRow[]> {
  return db
    .select()
    .from(journalMedia)
    .orderBy(desc(journalMedia.uploadedAt), asc(journalMedia.key));
}

/**
 * The stored file with these bytes, trashed or not: the first uploaded whose current bytes they
 * are; else the earliest uploaded or imported with them before a shrink changed its bytes.
 */
export async function journalMediaByHash(db: Db, sha256: string): Promise<JournalMediaRow | null> {
  const [current] = await db
    .select()
    .from(journalMedia)
    .where(eq(journalMedia.sha256, sha256))
    .orderBy(asc(journalMedia.uploadedAt), asc(journalMedia.key))
    .limit(1);
  if (current) return current;
  const [original] = await db
    .select({ row: journalMedia })
    .from(journalMediaRevisions)
    .innerJoin(journalMedia, eq(journalMedia.key, journalMediaRevisions.mediaKey))
    .where(
      and(
        eq(journalMediaRevisions.sha256, sha256),
        inArray(journalMediaRevisions.reason, ["upload", "import"]),
      ),
    )
    .orderBy(asc(journalMediaRevisions.id))
    .limit(1);
  return original?.row ?? null;
}

/**
 * The Journal posts that use each file, and where: its cover, its body, or both. Only these keys
 * when given, every file otherwise; a file no post uses has no row.
 */
export async function journalMediaUses(db: Db, keys?: string[]) {
  const query = (where?: ReturnType<typeof inArray>) =>
    db
      .select({
        key: journalMedia.key,
        slug: journalPosts.slug,
        title: journalPosts.title,
        inCover,
        inBody,
      })
      .from(journalMedia)
      .innerJoin(journalPosts, named)
      .where(where)
      .orderBy(asc(journalMedia.key), asc(journalPosts.slug));
  if (keys === undefined) return query();
  const rows = [];
  for (const part of chunked(keys)) rows.push(...(await query(inArray(journalMedia.key, part))));
  return rows;
}

export type JournalMediaInsert = typeof journalMedia.$inferInsert;

export async function insertJournalMedia(db: Db, row: JournalMediaInsert): Promise<void> {
  await db.insert(journalMedia).values(row);
}

export type JournalMediaFields = Partial<Omit<JournalMediaRow, "key" | "rev">>;

export type JournalMediaWrite =
  | { ok: true; row: JournalMediaRow }
  | { ok: false; reason: "missing" }
  | { ok: false; reason: "stale"; rev: number };

/**
 * Writes fields onto the row and moves its rev, in one statement that also checks the rev the
 * caller loaded. With no fields it only moves the rev: a claim made before an R2 write, so a stale
 * writer is refused before any object changes.
 */
export async function writeJournalMediaAtRev(
  db: Db,
  key: string,
  fields: JournalMediaFields,
  expectedRev: number,
): Promise<JournalMediaWrite> {
  const [written] = await db
    .update(journalMedia)
    .set({ ...fields, rev: sql`${journalMedia.rev} + 1` })
    .where(and(eq(journalMedia.key, key), eq(journalMedia.rev, expectedRev)))
    .returning();
  if (written) return { ok: true, row: written };
  const now = await getJournalMedia(db, key);
  return now ? { ok: false, reason: "stale", rev: now.rev } : { ok: false, reason: "missing" };
}

/** Columns that follow a byte change whose rev the caller already moved: written, the rev left alone. */
export async function followJournalMedia(
  db: Db,
  key: string,
  fields: JournalMediaFields,
): Promise<JournalMediaRow | null> {
  if (Object.keys(fields).length === 0) return getJournalMedia(db, key);
  const [written] = await db
    .update(journalMedia)
    .set(fields)
    .where(eq(journalMedia.key, key))
    .returning();
  return written ?? null;
}

/**
 * Removes the row and its revisions in one batch, the row only while it is at `rev` and no post
 * names the file. "stale" when the rev moved, "in-use" when a post names it, "missing" with no row.
 */
export async function removeJournalMedia(
  db: Db,
  key: string,
  rev: number,
): Promise<"removed" | "stale" | "in-use" | "missing"> {
  const state = async () => {
    const now = await getJournalMedia(db, key);
    return !now ? "missing" : now.rev !== rev ? "stale" : null;
  };
  const before = await state();
  if (before) return before;
  const [removed] = await db.batch([
    db
      .delete(journalMedia)
      .where(
        and(
          eq(journalMedia.key, key),
          eq(journalMedia.rev, rev),
          sql`NOT EXISTS (SELECT 1 FROM ${journalPosts} WHERE ${named})`,
        ),
      )
      .returning({ key: journalMedia.key }),
    db
      .delete(journalMediaRevisions)
      .where(
        and(
          eq(journalMediaRevisions.mediaKey, key),
          sql`NOT EXISTS (SELECT 1 FROM ${journalMedia} WHERE ${journalMedia.key} = ${key})`,
        ),
      ),
  ]);
  if (removed.length > 0) return "removed";
  return (await state()) ?? "in-use";
}

// ---- Byte history ----------------------------------------------------------------

/** Newest first. */
export async function listJournalMediaRevisions(db: Db, key: string, limit = 100) {
  return db
    .select()
    .from(journalMediaRevisions)
    .where(eq(journalMediaRevisions.mediaKey, key))
    .orderBy(desc(journalMediaRevisions.id))
    .limit(limit);
}

export async function addJournalMediaRevision(
  db: Db,
  row: typeof journalMediaRevisions.$inferInsert,
): Promise<number> {
  const [made] = await db
    .insert(journalMediaRevisions)
    .values(row)
    .returning({ id: journalMediaRevisions.id });
  if (!made) throw new Error(`the revision for ${row.mediaKey} was not recorded`);
  return made.id;
}

/** Records where BACKUPS keeps a revision's bytes, once newer bytes replace them. */
export async function keepJournalMediaRevision(
  db: Db,
  id: number,
  backupKey: string,
): Promise<void> {
  await db.update(journalMediaRevisions).set({ backupKey }).where(eq(journalMediaRevisions.id, id));
}

// ---- Change log --------------------------------------------------------------------

/** The newest change's sequence number: where a poll starts from. 0 for an empty log. */
export async function journalMediaChangeCursor(db: Db): Promise<number> {
  const [row] = await db
    .select({ seq: sql<number | null>`max(${journalMediaChanges.seq})` })
    .from(journalMediaChanges);
  return row?.seq ?? 0;
}

/**
 * Each file changed after `from` and up to `to`, once, at its latest change, oldest first:
 * at most `limit + 1`, so the caller knows whether more wait.
 */
export async function journalMediaChangedSince(db: Db, from: number, to: number, limit: number) {
  return db
    .select({
      key: journalMediaChanges.mediaKey,
      seq: sql<number>`max(${journalMediaChanges.seq})`,
    })
    .from(journalMediaChanges)
    .where(sql`${journalMediaChanges.seq} > ${from} AND ${journalMediaChanges.seq} <= ${to}`)
    .groupBy(journalMediaChanges.mediaKey)
    .orderBy(sql`max(${journalMediaChanges.seq})`)
    .limit(limit + 1);
}
