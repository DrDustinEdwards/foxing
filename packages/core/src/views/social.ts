// Social views: the feed, a profile page, the reader's own diary, people, a reading
// list, and a recap, in their /api/v1 wire shape (@foxing/types). Visibility resolves
// here, server-side (socialDomain.visibleVisibilitiesFor); no caller re-implements it.
import type * as W from "@foxing/types";
import type { Db } from "../db";
import * as recapDomain from "../domain/recap";
import * as socialDomain from "../domain/social";
import * as annotationsRepo from "../repositories/annotations";
import * as catalogRepo from "../repositories/catalog";
import * as diaryRepo from "../repositories/diary";
import * as libraryRepo from "../repositories/library";
import * as profilesRepo from "../repositories/profiles";
import * as reactionsRepo from "../repositories/reactions";
import * as socialRepo from "../repositories/social";
import { bookRefs, ms } from "./wire";

/** The viewer's activity feed, with actor identity and book cards. */
export async function feed(db: Db, viewerId: string, cursor: number | null): Promise<W.FeedPage> {
  const page = await socialDomain.getFeed(db, viewerId, { cursor });
  const actorIds: string[] = [];
  const bookIds: string[] = [];
  for (const item of page.items) {
    if (item.kind === "activity") {
      actorIds.push(item.event.userId);
      if (item.event.bookId) bookIds.push(item.event.bookId);
    }
  }
  const [actors, books] = await Promise.all([
    profilesRepo.getProfileSummaries(db, actorIds),
    bookRefs(db, bookIds),
  ]);
  const rows = page.items.map((item): W.FeedRow => {
    if (item.kind === "activity") {
      const e = item.event;
      const b = e.bookId ? books.get(e.bookId) : undefined;
      return {
        kind: "activity",
        id: e.id,
        type: e.type,
        actor: actors.get(e.userId) ?? null,
        book: b ? { id: b.id, title: b.title, slug: b.slug, coverUrl: b.coverUrl } : null,
        data: (e.data ?? {}) as Record<string, unknown>,
        createdAt: ms(e.createdAt) ?? 0,
      };
    }
    return {
      kind: "follower",
      id: item.notification.id,
      actorLabel: item.notification.body ?? "Someone started following you.",
      createdAt: ms(item.createdAt) ?? 0,
    };
  });
  return { rows, nextCursor: page.nextCursor };
}

async function diaryEntries(db: Db, entries: diaryRepo.DiaryEntry[]): Promise<W.DiaryEntry[]> {
  const books = await bookRefs(
    db,
    entries.map((d) => d.bookId),
  );
  return entries.map((d) => ({
    id: d.id,
    bookId: d.bookId,
    book: books.get(d.bookId) ?? null,
    ratingHalf: d.ratingHalf,
    review: d.review,
    containsSpoilers: d.containsSpoilers,
    visibility: d.visibility as W.Visibility,
    logDate: ms(d.logDate),
  }));
}

/** A profile by username, or null when there is none. */
export async function profilePage(
  db: Db,
  username: string,
  viewerId: string | null,
): Promise<W.ProfilePage | null> {
  const profile = await profilesRepo.getProfileByUsername(db, username);
  if (!profile) return null;

  const isOwner = viewerId === profile.id;
  // A non-public profile shows a "private" notice to everyone but its owner, with just
  // enough identity to confirm the account exists (Grok audit 2026-10-21, FX-2).
  if (!isOwner && (profile.visibility?.profile ?? "public") !== "public") {
    return {
      isPrivate: true,
      profile: {
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
      },
    };
  }

  // Currently-reading follows the owner's progress visibility: private means only the
  // owner sees it.
  const showProgress = isOwner || (profile.visibility?.progress ?? "public") !== "private";
  const allowed = await socialDomain.visibleVisibilitiesFor(db, profile.id, viewerId);
  const [
    diary,
    lists,
    activity,
    followerCount,
    followingCount,
    isFollowing,
    viewerHasAsCloseFriend,
    currentlyReading,
    booksRead,
    highlightCount,
    favorites,
    publicShelves,
    finishedBooks,
    publicHighlights,
  ] = await Promise.all([
    diaryRepo.listEntriesForUser(db, profile.id, allowed, { limit: 30 }),
    socialRepo.listListsForUser(db, profile.id, { publicOnly: !isOwner }),
    socialRepo.listActivityForUser(db, profile.id, allowed, { limit: 30 }),
    socialRepo.countFollowers(db, profile.id),
    socialRepo.countFollowing(db, profile.id),
    viewerId ? socialRepo.isFollowing(db, viewerId, profile.id) : false,
    viewerId
      ? socialRepo.listCloseFriendIds(db, viewerId).then((ids) => ids.includes(profile.id))
      : false,
    showProgress ? libraryRepo.listCurrentlyReading(db, profile.id, 6) : [],
    libraryRepo.countFinishedBooks(db, profile.id),
    annotationsRepo.countPublicHighlights(db, profile.id),
    libraryRepo.listFavoriteBooks(db, profile.id, 5),
    libraryRepo.listPublicShelves(db, profile.id),
    libraryRepo.listFinishedBooks(db, profile.id, 8),
    annotationsRepo.listPublicHighlights(db, profile.id, 6),
  ]);

  return {
    isPrivate: false,
    profile: {
      id: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      bio: profile.bio,
      favoriteGenres: profile.favoriteGenres ?? [],
      createdAt: ms(profile.createdAt),
    },
    isOwner,
    isFollowing,
    viewerHasAsCloseFriend,
    followerCount,
    followingCount,
    booksRead,
    highlightCount,
    favorites,
    publicShelves,
    finishedBooks,
    publicHighlights: publicHighlights.map((h) => ({
      id: h.id,
      selectedText: h.selectedText,
      bookTitle: h.bookTitle,
      bookSlug: h.bookSlug,
    })),
    currentlyReading: currentlyReading.map((b) => ({
      bookId: b.bookId,
      title: b.title,
      author: b.author,
      slug: b.slug,
      coverUrl: b.coverUrl,
      progressPct: b.progressPct,
    })),
    diary: await diaryEntries(db, diary),
    lists: lists.map((l) => ({
      id: l.id,
      title: l.title,
      slug: l.slug,
      description: l.description,
      isPublic: l.isPublic,
    })),
    activity: activity.map((a) => ({
      id: a.id,
      type: a.type,
      bookId: a.bookId,
      data: (a.data ?? {}) as Record<string, unknown>,
      visibility: a.visibility as W.Visibility,
      createdAt: ms(a.createdAt) ?? 0,
    })),
  };
}

/** The reader's own reading log, newest-logged first, every visibility (it is theirs). */
export async function diary(db: Db, userId: string): Promise<W.DiaryEntry[]> {
  const entries = await diaryRepo.listEntriesForUser(db, userId, ["private", "friends", "public"], {
    limit: 100,
  });
  return diaryEntries(db, entries);
}

/** One diary entry, or null when the viewer may not see it: the author sees everything,
 *  a close friend friends and public, anyone else public only (FX-7). */
export async function diaryEntry(
  db: Db,
  entryId: string,
  viewerId: string | null,
): Promise<W.DiaryEntry | null> {
  const entry = await diaryRepo.getEntryById(db, entryId);
  if (!entry) return null;
  const visible = await socialDomain.visibleVisibilitiesFor(db, entry.userId, viewerId);
  if (!visible.includes(entry.visibility)) return null;
  return (await diaryEntries(db, [entry]))[0] ?? null;
}

/** Who the viewer follows, who follows them, and their close friends. */
export async function people(db: Db, viewerId: string): Promise<W.PeoplePage> {
  const [followingIds, followerIds, closeFriendIds] = await Promise.all([
    socialRepo.listFollowingIds(db, viewerId),
    socialRepo.listFollowerIds(db, viewerId),
    socialRepo.listCloseFriendIds(db, viewerId),
  ]);
  const summaries = await profilesRepo.getProfileSummaries(db, [
    ...followingIds,
    ...followerIds,
    ...closeFriendIds,
  ]);
  const pick = (ids: string[]) =>
    ids.map((id) => summaries.get(id)).filter((p): p is W.ProfileSummary => !!p);
  const following = new Set(followingIds);
  const close = new Set(closeFriendIds);
  return {
    following: pick(followingIds).map((p) => ({ ...p, isClose: close.has(p.id) })),
    followers: pick(followerIds).map((p) => ({ ...p, isFollowing: following.has(p.id) })),
    closeFriends: pick(closeFriendIds),
  };
}

/** A reading list, or null when it is private and not the viewer's. */
export async function listPage(
  db: Db,
  listId: string,
  viewerId: string | null,
): Promise<W.ListPage | null> {
  const list = await socialRepo.getListById(db, listId);
  if (!list) return null;
  const isOwner = viewerId === list.userId;
  if (!list.isPublic && !isOwner) return null;

  const [entries, owner, likeCount, liked] = await Promise.all([
    socialRepo.listBooks(db, list.id),
    profilesRepo.getProfileSummaries(db, [list.userId]),
    reactionsRepo.countReactions(db, "reading_list", list.id, "like"),
    viewerId ? reactionsRepo.hasReacted(db, viewerId, "reading_list", list.id, "like") : false,
  ]);
  const books = await catalogRepo.getBooksByIds(
    db,
    entries.map((e) => e.bookId),
  );
  const byId = new Map(books.map((b) => [b.id, b]));
  return {
    list: {
      id: list.id,
      title: list.title,
      description: list.description,
      isPublic: list.isPublic,
    },
    isOwner,
    owner: owner.get(list.userId) ?? null,
    likeCount,
    liked,
    books: entries.map((e) => ({
      bookId: e.bookId,
      note: e.note,
      position: e.position,
      book: byId.get(e.bookId) ?? null,
    })),
  };
}

/** A year's recap for the viewer, or for a public profile by username. */
export async function recap(
  db: Db,
  target: { userId: string } | { username: string },
  year: number,
  viewerId: string | null,
): Promise<{ recap: recapDomain.Recap; displayName: string; username: string } | null> {
  const p =
    "userId" in target
      ? await profilesRepo.getProfileById(db, target.userId)
      : await profilesRepo.getProfileByUsername(db, target.username);
  if (!p) return null;
  if (
    "username" in target &&
    viewerId !== p.id &&
    (p.visibility?.profile ?? "public") !== "public"
  ) {
    return null;
  }
  return {
    recap: await recapDomain.getRecap(db, p.id, year),
    displayName: p.displayName ?? p.username,
    username: p.username,
  };
}
