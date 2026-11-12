// The Journal's reads of the media library (schema/media.ts, site-api's standard tables, which
// site-api's d1MediaStore alone writes: apps/web/app/lib/carrel/journal-media-adapter.server.ts).
// "Used by" is the Journal's own text: a post uses a file when its cover_image_url or its markdown
// names the file's address (/media/<key>).
import { asc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../db";
import { chunked } from "../db";
import { journalPosts, media } from "../schema";

export type JournalMediaRow = typeof media.$inferSelect;

/** Where every file is served, before its key: what a post's text names when it uses one. */
export const JOURNAL_MEDIA_PATH = "/media/";

/** The post names the file in this row in its cover, or in its body. */
const inCover = sql<number>`instr(coalesce(${journalPosts.coverImageUrl}, ''), ${JOURNAL_MEDIA_PATH} || ${media.key}) > 0`;
const inBody = sql<number>`instr(${journalPosts.content}, ${JOURNAL_MEDIA_PATH} || ${media.key}) > 0`;
const named = sql`(${inCover} OR ${inBody})`;

/**
 * d1MediaStore's `inUse`: a post names the file (every `?` is the file's key), so a delete never
 * removes a file a post saved during it uses.
 */
export const JOURNAL_MEDIA_IN_USE = `EXISTS (SELECT 1 FROM journal_posts WHERE instr(coalesce(cover_image_url, ''), '${JOURNAL_MEDIA_PATH}' || ?) > 0 OR instr(content, '${JOURNAL_MEDIA_PATH}' || ?) > 0)`;

export async function getJournalMedia(db: Db, key: string): Promise<JournalMediaRow | null> {
  const [row] = await db.select().from(media).where(eq(media.key, key)).limit(1);
  return row ?? null;
}

/** The rows for these keys, in no particular order; absent keys are left out. */
export async function getJournalMediaMany(db: Db, keys: string[]): Promise<JournalMediaRow[]> {
  const rows: JournalMediaRow[] = [];
  for (const part of chunked(keys)) {
    rows.push(...(await db.select().from(media).where(inArray(media.key, part))));
  }
  return rows;
}

/**
 * The Journal posts that use each file, and where: its cover, its body, or both. Only these keys
 * when given, every file otherwise; a file no post uses has no row.
 */
export async function journalMediaUses(db: Db, keys?: string[]) {
  const query = (where?: ReturnType<typeof inArray>) =>
    db
      .select({
        key: media.key,
        slug: journalPosts.slug,
        title: journalPosts.title,
        inCover,
        inBody,
      })
      .from(media)
      .innerJoin(journalPosts, named)
      .where(where)
      .orderBy(asc(media.key), asc(journalPosts.slug));
  if (keys === undefined) return query();
  const rows = [];
  for (const part of chunked(keys)) rows.push(...(await query(inArray(media.key, part))));
  return rows;
}
