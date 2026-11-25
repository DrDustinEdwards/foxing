// The Journal's reads of the media library (schema/media.ts, written only by site-api's d1MediaStore). A post uses a file when its
// cover_image_url or markdown names the file's address (/media/<key>).
import { asc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../db";
import { chunked } from "../db";
import { journalPosts, media } from "../schema";

export type JournalMediaRow = typeof media.$inferSelect;

export const JOURNAL_MEDIA_PATH = "/media/";

const inCover = sql<number>`instr(coalesce(${journalPosts.coverImageUrl}, ''), ${JOURNAL_MEDIA_PATH} || ${media.key}) > 0`;
const inBody = sql<number>`instr(${journalPosts.content}, ${JOURNAL_MEDIA_PATH} || ${media.key}) > 0`;
const named = sql`(${inCover} OR ${inBody})`;

/** d1MediaStore's `inUse`: a post names the file (every `?` is its key), so a delete never removes a file a post saved during it uses. */
export const JOURNAL_MEDIA_IN_USE = `EXISTS (SELECT 1 FROM journal_posts WHERE instr(coalesce(cover_image_url, ''), '${JOURNAL_MEDIA_PATH}' || ?) > 0 OR instr(content, '${JOURNAL_MEDIA_PATH}' || ?) > 0)`;

export async function getJournalMedia(db: Db, key: string): Promise<JournalMediaRow | null> {
  const [row] = await db.select().from(media).where(eq(media.key, key)).limit(1);
  return row ?? null;
}

export async function getJournalMediaMany(db: Db, keys: string[]): Promise<JournalMediaRow[]> {
  const rows: JournalMediaRow[] = [];
  for (const part of chunked(keys)) {
    rows.push(...(await db.select().from(media).where(inArray(media.key, part))));
  }
  return rows;
}

/** The posts using each file (cover, body or both); only the given keys when present; a file no post uses has no row. */
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
