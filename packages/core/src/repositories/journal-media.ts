// The Journal's media index (schema/journal-media.ts): reads for Carrel's library and the
// versioned writes its site API makes. Every metadata write names the rev it was loaded at and is
// checked in the same statement, so a stale write is refused and never lost. "Used by" is the
// Journal's own text: a post uses a file when its cover_image_url or its markdown names the
// file's address (/media/<key>). Called only from apps/web/app/lib/carrel.
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNotNull,
  isNull,
  sql,
  type SQL,
} from "drizzle-orm";
import type { Db } from "../db";
import { chunked } from "../db";
import { journalMedia, journalMediaChanges, journalMediaRevisions, journalPosts } from "../schema";

export type JournalMediaRow = typeof journalMedia.$inferSelect;
export type JournalMediaRevision = typeof journalMediaRevisions.$inferSelect;

/** Where every file is served, before its key: what a post's text names when it uses one. */
export const JOURNAL_MEDIA_PATH = "/media/";

/** How many Journal posts use the file in this row: by cover, by body, or both, each post once. */
const usage = sql<number>`(SELECT count(*) FROM journal_posts p WHERE instr(coalesce(p.cover_image_url, ''), ${JOURNAL_MEDIA_PATH} || ${journalMedia.key}) > 0 OR instr(p.content, ${JOURNAL_MEDIA_PATH} || ${journalMedia.key}) > 0)`;

export type JournalMediaLens =
  | "unattached"
  | "no-alt"
  | "large"
  | "duplicates"
  | "license-expired"
  | "oversized";

export type JournalMediaFilter = {
  q?: string;
  tag?: string;
  /** true lists the trash; otherwise the trash is left out. */
  trashed: boolean;
  lens?: JournalMediaLens;
  orientation?: "landscape" | "portrait" | "square";
  kind?: "image" | "document" | "video" | "audio";
  /** The longest edge the oversized lens allows. */
  maxEdge: number;
};

/** The contract's large: over one MiB. */
const LARGE_BYTES = 1024 * 1024;

/** site-api's orientationOf, in SQL: square when the edges differ by at most 1% of the longer. */
const square = sql`(${journalMedia.width} > 0 AND ${journalMedia.height} > 0 AND abs(${journalMedia.width} - ${journalMedia.height}) * 100 <= max(${journalMedia.width}, ${journalMedia.height}))`;

function lensWhere(lens: JournalMediaLens, maxEdge: number): SQL {
  switch (lens) {
    case "unattached":
      return sql`${usage} = 0`;
    case "no-alt":
      return sql`${journalMedia.alt} = ''`;
    case "large":
      return sql`${journalMedia.bytes} > ${LARGE_BYTES}`;
    case "duplicates":
      return sql`EXISTS (SELECT 1 FROM journal_media d WHERE d.sha256 = ${journalMedia.sha256} AND d.key <> ${journalMedia.key})`;
    case "license-expired":
      return sql`(${journalMedia.licenseExpires} IS NOT NULL AND ${journalMedia.licenseExpires} < date('now'))`;
    case "oversized":
      return sql`max(coalesce(${journalMedia.width}, 0), coalesce(${journalMedia.height}, 0)) > ${maxEdge}`;
  }
}

function whereOf(filter: JournalMediaFilter): SQL | undefined {
  const where: SQL[] = [
    filter.trashed ? isNotNull(journalMedia.trashedAt) : isNull(journalMedia.trashedAt),
  ];
  if (filter.q) {
    const pattern = `%${filter.q.toLowerCase()}%`;
    where.push(
      sql`(lower(coalesce(${journalMedia.filename}, '')) LIKE ${pattern} OR lower(${journalMedia.key}) LIKE ${pattern} OR lower(${journalMedia.alt}) LIKE ${pattern} OR lower(${journalMedia.caption}) LIKE ${pattern})`,
    );
  }
  if (filter.tag)
    where.push(
      sql`EXISTS (SELECT 1 FROM json_each(${journalMedia.tags}) WHERE value = ${filter.tag})`,
    );
  if (filter.lens) where.push(lensWhere(filter.lens, filter.maxEdge));
  if (filter.orientation === "square") where.push(square);
  if (filter.orientation === "landscape")
    where.push(sql`(${journalMedia.width} > ${journalMedia.height} AND NOT ${square})`);
  if (filter.orientation === "portrait")
    where.push(sql`(${journalMedia.height} > ${journalMedia.width} AND NOT ${square})`);
  if (filter.kind === "document") {
    where.push(
      sql`NOT (${journalMedia.contentType} LIKE 'image/%' OR ${journalMedia.contentType} LIKE 'video/%' OR ${journalMedia.contentType} LIKE 'audio/%')`,
    );
  } else if (filter.kind) {
    where.push(sql`${journalMedia.contentType} LIKE ${`${filter.kind}/%`}`);
  }
  return and(...where);
}

export type JournalMediaSort = "added" | "name" | "size" | "used";

/** One page of the library, each row with its usage count. The trash runs newest trashed first. */
export async function listJournalMedia(
  db: Db,
  filter: JournalMediaFilter,
  page: { sort: JournalMediaSort; dir: "asc" | "desc"; limit: number; offset: number },
) {
  const by = {
    added: journalMedia.uploadedAt,
    name: sql`lower(coalesce(${journalMedia.filename}, ${journalMedia.key}))`,
    size: journalMedia.bytes,
    used: usage,
  }[page.sort];
  const order = filter.trashed
    ? [desc(journalMedia.trashedAt), asc(journalMedia.key)]
    : [page.dir === "asc" ? asc(by) : desc(by), asc(journalMedia.key)];
  return db
    .select({ ...getTableColumns(journalMedia), usedCount: usage })
    .from(journalMedia)
    .where(whereOf(filter))
    .orderBy(...order)
    .limit(page.limit)
    .offset(page.offset);
}

export async function countJournalMedia(db: Db, filter: JournalMediaFilter): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(journalMedia)
    .where(whereOf(filter));
  return row?.n ?? 0;
}

export async function getJournalMedia(db: Db, key: string): Promise<JournalMediaRow | null> {
  const [row] = await db.select().from(journalMedia).where(eq(journalMedia.key, key)).limit(1);
  return row ?? null;
}

/** The rows for these keys with their usage counts, in no particular order; absent keys are left out. */
export async function getJournalMediaMany(db: Db, keys: string[]) {
  const rows = [];
  for (const part of chunked(keys)) {
    rows.push(
      ...(await db
        .select({ ...getTableColumns(journalMedia), usedCount: usage })
        .from(journalMedia)
        .where(inArray(journalMedia.key, part))),
    );
  }
  return rows;
}

/** The stored file with these bytes, trashed or not; the oldest when several share them. */
export async function journalMediaByHash(db: Db, sha256: string) {
  const [row] = await db
    .select({ ...getTableColumns(journalMedia), usedCount: usage })
    .from(journalMedia)
    .where(eq(journalMedia.sha256, sha256))
    .orderBy(asc(journalMedia.uploadedAt), asc(journalMedia.key))
    .limit(1);
  return row ?? null;
}

/** Every other file whose bytes are exactly this one's. */
export async function journalMediaTwins(db: Db, key: string, sha256: string) {
  return db
    .select({ key: journalMedia.key, filename: journalMedia.filename })
    .from(journalMedia)
    .where(and(eq(journalMedia.sha256, sha256), sql`${journalMedia.key} <> ${key}`))
    .orderBy(asc(journalMedia.key))
    .limit(50);
}

/** The Journal posts that use a file, and where: its cover, its body, or both. */
export async function journalMediaUses(db: Db, key: string) {
  const address = `${JOURNAL_MEDIA_PATH}${key}`;
  return db
    .select({
      slug: journalPosts.slug,
      title: journalPosts.title,
      inCover: sql<number>`instr(coalesce(${journalPosts.coverImageUrl}, ''), ${address}) > 0`,
      inBody: sql<number>`instr(${journalPosts.content}, ${address}) > 0`,
    })
    .from(journalPosts)
    .where(
      sql`instr(coalesce(${journalPosts.coverImageUrl}, ''), ${address}) > 0 OR instr(${journalPosts.content}, ${address}) > 0`,
    )
    .orderBy(asc(journalPosts.slug));
}

export type JournalMediaInsert = typeof journalMedia.$inferInsert;

export async function insertJournalMedia(db: Db, row: JournalMediaInsert): Promise<void> {
  await db.insert(journalMedia).values(row);
}

export type JournalMediaFields = Partial<Omit<JournalMediaRow, "key" | "rev" | "uploadedAt">>;

export type JournalMediaWrite =
  | { ok: true; rev: number }
  | { ok: false; reason: "missing" | "stale"; rev: number };

/**
 * Writes fields onto the row and moves its rev, in one statement that also checks the rev the
 * caller loaded (`expectedRev`; undefined writes whatever the rev). With no fields it only moves
 * the rev: a claim made before an R2 write, so a stale writer is refused before any object changes.
 */
export async function writeJournalMediaAtRev(
  db: Db,
  key: string,
  fields: JournalMediaFields,
  expectedRev?: number,
): Promise<JournalMediaWrite> {
  const match =
    expectedRev === undefined
      ? eq(journalMedia.key, key)
      : and(eq(journalMedia.key, key), eq(journalMedia.rev, expectedRev));
  const [written] = await db
    .update(journalMedia)
    .set({ ...fields, rev: sql`${journalMedia.rev} + 1` })
    .where(match)
    .returning({ rev: journalMedia.rev });
  if (written) return { ok: true, rev: written.rev };
  const now = await getJournalMedia(db, key);
  return now
    ? { ok: false, reason: "stale", rev: now.rev }
    : { ok: false, reason: "missing", rev: -1 };
}

/** Removes the row only if no post uses the file now, in one statement. False: used, or gone. */
export async function deleteJournalMediaIfUnused(db: Db, key: string): Promise<boolean> {
  const removed = await db
    .delete(journalMedia)
    .where(and(eq(journalMedia.key, key), sql`${usage} = 0`))
    .returning({ key: journalMedia.key });
  return removed.length > 0;
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
