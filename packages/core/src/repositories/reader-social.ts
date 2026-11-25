// Reads for the social reading layer: others' annotations a viewer may see, club passage discussion and popular highlights.
// Authorization lives in the SQL: every branch is a positive filter on a non-private visibility AND an entitled user set, so an
// unauthorized row is never fetched. domain/reader-annotations applies the spoiler gate and never widens what the SQL admits.
import { and, eq, gte, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { chunked, type Db } from "../db";
import { annotations, clubMembers, clubs, closeFriends, profiles } from "../schema";

// Only highlights and notes carry a reader decoration; bookmarks and commonplace are
// never part of another reader's layer.
const OTHER_TYPES = ["highlight", "note"] as const;

export type AuthorRef = {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

export type SocialAnnotationRow = {
  id: string;
  userId: string;
  type: string;
  locator: Record<string, unknown> | null;
  selectedText: string | null;
  body: string | null;
  color: string | null;
  chapter: string | null;
  visibility: string;
  containsSpoilers: boolean;
  isPinned: boolean;
  clubId: string | null;
  parentId: string | null;
  createdAt: Date;
  author: AuthorRef;
};

const rowShape = {
  id: annotations.id,
  userId: annotations.userId,
  type: annotations.type,
  locator: annotations.locator,
  selectedText: annotations.selectedText,
  body: annotations.body,
  color: annotations.color,
  chapter: annotations.chapter,
  visibility: annotations.visibility,
  containsSpoilers: annotations.containsSpoilers,
  isPinned: annotations.isPinned,
  clubId: annotations.clubId,
  parentId: annotations.parentId,
  createdAt: annotations.createdAt,
  authorId: profiles.id,
  authorUsername: profiles.username,
  authorDisplayName: profiles.displayName,
  authorAvatarUrl: profiles.avatarUrl,
} as const;

function toRow(
  r: Omit<SocialAnnotationRow, "author"> & {
    authorId: string;
    authorUsername: string | null;
    authorDisplayName: string | null;
    authorAvatarUrl: string | null;
  },
): SocialAnnotationRow {
  const { authorId, authorUsername, authorDisplayName, authorAvatarUrl, ...row } = r;
  return {
    ...row,
    author: {
      id: authorId,
      username: authorUsername,
      displayName: authorDisplayName,
      avatarUrl: authorAvatarUrl,
    },
  };
}

/** V: the viewer's active clubs whose CURRENT read (clubs.current_book_id) is this book, so a finished-book club_books row keeps no passage layer alive. */
export async function viewerClubIdsReadingBook(
  db: Db,
  viewerId: string,
  bookId: string,
): Promise<string[]> {
  return (await shareableClubsForBook(db, viewerId, bookId)).map((c) => c.id);
}

/** V with names, for the reader's "Share to club" toggle. */
export async function shareableClubsForBook(
  db: Db,
  viewerId: string,
  bookId: string,
): Promise<{ id: string; name: string }[]> {
  const rows = await db
    .select({ id: clubs.id, name: clubs.name })
    .from(clubMembers)
    .innerJoin(clubs, eq(clubs.id, clubMembers.clubId))
    .where(
      and(
        eq(clubMembers.userId, viewerId),
        eq(clubMembers.status, "active"),
        eq(clubs.currentBookId, bookId),
      ),
    );
  const seen = new Map<string, string>();
  for (const r of rows) if (!seen.has(r.id)) seen.set(r.id, r.name);
  return [...seen.entries()].map(([id, name]) => ({ id, name }));
}

/** A: other users who are active members of any club in V; their visibility='club' annotations are entitled. */
export async function coReadingAuthorIds(
  db: Db,
  clubIds: string[],
  viewerId: string,
): Promise<string[]> {
  if (clubIds.length === 0) return [];
  const out = new Set<string>();
  for (const chunk of chunked(clubIds)) {
    const rows = await db
      .select({ userId: clubMembers.userId })
      .from(clubMembers)
      .where(and(inArray(clubMembers.clubId, chunk), eq(clubMembers.status, "active")));
    for (const r of rows) if (r.userId !== viewerId) out.add(r.userId);
  }
  return [...out];
}

/** F: authors who added the viewer to their close friends; their visibility='friends' annotations are entitled. */
export async function closeFriendAuthorIds(db: Db, viewerId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: closeFriends.userId })
    .from(closeFriends)
    .where(eq(closeFriends.friendId, viewerId));
  return [...new Set(rows.map((r) => r.userId))];
}

/** Others' annotations by a fixed author set at one visibility; the set encodes the entitlement, so it cannot leak a non-entitled row. */
async function othersByAuthors(
  db: Db,
  bookId: string,
  authorIds: string[],
  visibility: "club" | "friends",
): Promise<SocialAnnotationRow[]> {
  if (authorIds.length === 0) return [];
  const out: SocialAnnotationRow[] = [];
  for (const chunk of chunked(authorIds)) {
    const rows = await db
      .select(rowShape)
      .from(annotations)
      .innerJoin(profiles, eq(profiles.id, annotations.userId))
      .where(
        and(
          eq(annotations.bookId, bookId),
          inArray(annotations.userId, chunk),
          eq(annotations.visibility, visibility),
          inArray(annotations.type, OTHER_TYPES as unknown as string[]),
        ),
      );
    for (const r of rows) out.push(toRow(r));
  }
  return out;
}

export function clubOthers(db: Db, bookId: string, authorIds: string[]) {
  return othersByAuthors(db, bookId, authorIds, "club");
}

export function friendOthers(db: Db, bookId: string, authorIds: string[]) {
  return othersByAuthors(db, bookId, authorIds, "friends");
}

/** Any user's public highlight/note on this book, minus the viewer's own (those come via MINE); anonymous skips the exclusion. */
export async function publicOthers(
  db: Db,
  bookId: string,
  viewerId: string | null,
): Promise<SocialAnnotationRow[]> {
  const conds = [
    eq(annotations.bookId, bookId),
    eq(annotations.visibility, "public"),
    inArray(annotations.type, OTHER_TYPES as unknown as string[]),
  ];
  if (viewerId) conds.push(ne(annotations.userId, viewerId));
  const rows = await db
    .select(rowShape)
    .from(annotations)
    .innerJoin(profiles, eq(profiles.id, annotations.userId))
    .where(and(...conds));
  return rows.map(toRow);
}

/** Passage comments in the viewer's active clubs reading the book; club_id IN V is the whole access check. */
export async function commentsInClubs(
  db: Db,
  bookId: string,
  clubIds: string[],
): Promise<SocialAnnotationRow[]> {
  if (clubIds.length === 0) return [];
  const out: SocialAnnotationRow[] = [];
  for (const chunk of chunked(clubIds)) {
    const rows = await db
      .select(rowShape)
      .from(annotations)
      .innerJoin(profiles, eq(profiles.id, annotations.userId))
      .where(
        and(
          eq(annotations.type, "comment"),
          eq(annotations.bookId, bookId),
          inArray(annotations.clubId, chunk),
        ),
      );
    for (const r of rows) out.push(toRow(r));
  }
  return out;
}

export type PopularRow = {
  normalizedText: string;
  count: number;
  locator: Record<string, unknown> | null;
};

/** Passages >= 3 DISTINCT users highlighted publicly (never a private or club one), anchored on the earliest locator. */
export async function popularHighlights(db: Db, bookId: string): Promise<PopularRow[]> {
  // Grouped in SQL, so a book with many public highlights sends back one row per popular passage, not every row.
  // SQLite takes a bare column (locator) from the row that min() picked, which is the earliest highlight.
  const readers = sql<number>`count(distinct ${annotations.userId})`;
  const rows = await db
    .select({
      normalizedText: annotations.normalizedText,
      count: readers,
      locator: annotations.locator,
      earliest: sql<number>`min(${annotations.createdAt})`,
    })
    .from(annotations)
    .where(
      and(
        eq(annotations.bookId, bookId),
        eq(annotations.type, "highlight"),
        eq(annotations.visibility, "public"),
        isNotNull(annotations.normalizedText),
      ),
    )
    .groupBy(annotations.normalizedText)
    .having(gte(readers, popularThreshold()));
  return rows.map((r) => ({
    normalizedText: r.normalizedText as string,
    count: Number(r.count),
    locator: r.locator ?? null,
  }));
}

export function popularThreshold(): number {
  return 3;
}
