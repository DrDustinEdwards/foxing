// Social reading layer reads (the club passage layer + shared annotations). These
// resolve which OTHERS' annotations a viewer may see in the reader, plus the club
// passage discussion and the popular-highlights aggregation. Authorization lives in
// the SQL here: every branch is a positive filter (a non-private visibility AND a
// user set the viewer is entitled to), so an unauthorized row is never fetched, let
// alone returned. The domain layer (domain/reader-annotations) composes these and
// applies the courtesy spoiler/progress gate; it never widens what the SQL admits.
import { and, eq, inArray, isNotNull, ne, or } from "drizzle-orm";
import type { Db } from "../db";
import { annotations, clubBooks, clubMembers, clubs, closeFriends, profiles } from "../schema";

// D1 caps a query at 100 bound variables. Keep every IN list under that.
const CHUNK = 90;
function chunked<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) out.push(items.slice(i, i + CHUNK));
  return out;
}

// Only highlights and notes carry a reader decoration; bookmarks and commonplace are
// never part of another reader's layer.
const OTHER_TYPES = ["highlight", "note"] as const;

/** Author identity attached to every others' row so the popover can attribute it. */
export type AuthorRef = {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

/** A raw annotation row admitted by one of the visibility branches, with its author. */
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

function toRow(r: {
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
  authorId: string;
  authorUsername: string | null;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
}): SocialAnnotationRow {
  return {
    id: r.id,
    userId: r.userId,
    type: r.type,
    locator: r.locator,
    selectedText: r.selectedText,
    body: r.body,
    color: r.color,
    chapter: r.chapter,
    visibility: r.visibility,
    containsSpoilers: r.containsSpoilers,
    isPinned: r.isPinned,
    clubId: r.clubId,
    parentId: r.parentId,
    createdAt: r.createdAt,
    author: {
      id: r.authorId,
      username: r.authorUsername,
      displayName: r.authorDisplayName,
      avatarUrl: r.authorAvatarUrl,
    },
  };
}

/** V: the viewer's ACTIVE clubs whose CURRENT read is this book. Restricted to the
 *  current read (clubs.current_book_id OR club_books.is_current), so a finished-book
 *  club_books row does NOT keep a passage layer alive. This one set defines both who
 *  the viewer co-reads with and which passage discussion they may see. */
export async function viewerClubIdsReadingBook(
  db: Db,
  viewerId: string,
  bookId: string,
): Promise<string[]> {
  const rows = await db
    .select({ clubId: clubMembers.clubId })
    .from(clubMembers)
    .innerJoin(clubs, eq(clubs.id, clubMembers.clubId))
    .leftJoin(
      clubBooks,
      and(
        eq(clubBooks.clubId, clubMembers.clubId),
        eq(clubBooks.bookId, bookId),
        eq(clubBooks.isCurrent, true),
      ),
    )
    .where(
      and(
        eq(clubMembers.userId, viewerId),
        eq(clubMembers.status, "active"),
        or(eq(clubs.currentBookId, bookId), isNotNull(clubBooks.id)),
      ),
    );
  return [...new Set(rows.map((r) => r.clubId))];
}

/** The viewer's active clubs whose CURRENT read is this book, with names, for the
 *  reader's "Share to club" toggle. Same current-read scope as V; a share targets the
 *  club context the reply/comment is written into. */
export async function shareableClubsForBook(
  db: Db,
  viewerId: string,
  bookId: string,
): Promise<{ id: string; name: string }[]> {
  const rows = await db
    .select({ id: clubs.id, name: clubs.name })
    .from(clubMembers)
    .innerJoin(clubs, eq(clubs.id, clubMembers.clubId))
    .leftJoin(
      clubBooks,
      and(
        eq(clubBooks.clubId, clubMembers.clubId),
        eq(clubBooks.bookId, bookId),
        eq(clubBooks.isCurrent, true),
      ),
    )
    .where(
      and(
        eq(clubMembers.userId, viewerId),
        eq(clubMembers.status, "active"),
        or(eq(clubs.currentBookId, bookId), isNotNull(clubBooks.id)),
      ),
    );
  const seen = new Map<string, string>();
  for (const r of rows) if (!seen.has(r.id)) seen.set(r.id, r.name);
  return [...seen.entries()].map(([id, name]) => ({ id, name }));
}

/** A: users (other than the viewer) who are ACTIVE members of any club in V. Their
 *  visibility='club' annotations are the ones the viewer is entitled to see. */
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

/** F: authors who added the viewer to their close friends. Their visibility='friends'
 *  annotations are the ones the viewer is entitled to see. */
export async function closeFriendAuthorIds(db: Db, viewerId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: closeFriends.userId })
    .from(closeFriends)
    .where(eq(closeFriends.friendId, viewerId));
  return [...new Set(rows.map((r) => r.userId))];
}

/** Others' annotations in a fixed set of authors at one visibility. Used for the club
 *  (authors=A, visibility='club') and friends (authors=F, visibility='friends')
 *  branches. The author set already encodes the entitlement, so this can never leak a
 *  non-entitled row. */
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

/** Public others: any user's visibility='public' highlight/note on this book, minus the
 *  viewer's own (those come back through MINE). viewerId null (anonymous) skips the
 *  self-exclusion, since there is no self to exclude. */
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

/** Passage discussion (type='comment') scoped to the viewer's active clubs reading the
 *  book (V). club_id IN V is the whole access check: a comment surfaces only inside a
 *  club the viewer actively belongs to and that reads the book. */
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

/** Popular highlights: normalized passages that >= 3 DISTINCT users have publicly
 *  highlighted. Counted from public highlights only, so it never reveals a private or
 *  club-scoped one. The representative locator is the earliest public highlight of that
 *  passage, used to anchor the subtle underline layer. */
export async function popularHighlights(db: Db, bookId: string): Promise<PopularRow[]> {
  const rows = await db
    .select({
      userId: annotations.userId,
      normalizedText: annotations.normalizedText,
      locator: annotations.locator,
      createdAt: annotations.createdAt,
    })
    .from(annotations)
    .where(
      and(
        eq(annotations.bookId, bookId),
        eq(annotations.type, "highlight"),
        eq(annotations.visibility, "public"),
        isNotNull(annotations.normalizedText),
      ),
    );

  const groups = new Map<
    string,
    { users: Set<string>; locator: Record<string, unknown> | null; earliest: number }
  >();
  for (const r of rows) {
    const key = r.normalizedText as string;
    const at = r.createdAt instanceof Date ? r.createdAt.getTime() : 0;
    const g = groups.get(key);
    if (!g) {
      groups.set(key, {
        users: new Set([r.userId]),
        locator: r.locator ?? null,
        earliest: at,
      });
    } else {
      g.users.add(r.userId);
      if (at < g.earliest) {
        g.earliest = at;
        g.locator = r.locator ?? null;
      }
    }
  }

  const out: PopularRow[] = [];
  for (const [normalizedText, g] of groups) {
    if (g.users.size >= 3) out.push({ normalizedText, count: g.users.size, locator: g.locator });
  }
  return out;
}

/** The distinct-user threshold a passage must clear to count as a popular highlight. */
export function popularThreshold(): number {
  return 3;
}
