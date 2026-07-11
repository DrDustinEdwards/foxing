// Social domain logic (Phase 6): follows, close friends, reading lists, and THE feed
// visibility resolver. Authorization and event emission live here, never in a client.
//
// FEED VISIBILITY CONTRACT (reviewed + approved 2026-07-11). The follow graph and the
// close-friends graph are INDEPENDENT. For a viewer V looking at an event authored by A:
//   - public event:  shown IFF V follows A.
//   - friends event: shown IFF V is on A's close-friends list. Following A is NOT enough.
//   - private event: never shown to anyone (and the diary path emits none).
// The bug this prevents: "follows implies friends" leaking friends-only content to every
// follower. A plain follower must never see a friends-only event. resolveFeed is a PURE
// function so the whole matrix is unit-tested without D1.
import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { emit, type EventActor } from "../events";
import * as socialRepo from "../repositories/social";
import { books, user as authUser } from "../schema";
import { domainErrors } from "./errors";

// -- Feed resolver (pure) ---------------------------------------------------

export type FeedItemKind = "activity" | "follower";

export type FeedItem =
  | { kind: "activity"; event: socialRepo.ActivityEvent }
  | { kind: "follower"; notification: socialRepo.FollowerNotification; createdAt: Date };

export type FeedInputs = {
  viewerId: string;
  followingIds: Iterable<string>; // authors V follows -> entitled to their PUBLIC events
  closeFriendAuthorIds: Iterable<string>; // authors whose close-friends list contains V
  events: socialRepo.ActivityEvent[];
};

/**
 * Filter candidate activity events down to what the viewer is entitled to see, applying
 * the two-independent-graphs rule above. Returns events only (follower items are merged
 * in by getFeed). Deterministic and side-effect free: this is the tested core.
 */
export function resolveFeed(input: FeedInputs): socialRepo.ActivityEvent[] {
  const following = new Set(input.followingIds);
  const closeFriendOf = new Set(input.closeFriendAuthorIds);
  return input.events.filter((e) => {
    if (e.userId === input.viewerId) return false; // own activity is not a feed candidate
    switch (e.visibility) {
      case "public":
        return following.has(e.userId);
      case "friends":
        return closeFriendOf.has(e.userId);
      default:
        return false; // private (or any unknown value) is never visible
    }
  });
}

// -- Follows ----------------------------------------------------------------

export async function followUser(db: Db, actor: EventActor, targetUserId: string): Promise<void> {
  if (targetUserId === actor.userId) throw domainErrors.validation("You cannot follow yourself.");
  const [target] = await db
    .select({ id: authUser.id })
    .from(authUser)
    .where(eq(authUser.id, targetUserId))
    .limit(1);
  if (!target) throw domainErrors.notFound("User not found.");

  const already = await socialRepo.isFollowing(db, actor.userId, targetUserId);
  await socialRepo.follow(db, actor.userId, targetUserId);
  // Notify only on a NEW edge, so re-follows do not spam the target.
  if (!already) {
    await emit(db, "follow.created", actor, { followingId: targetUserId });
  }
}

export async function unfollowUser(db: Db, actor: EventActor, targetUserId: string): Promise<void> {
  await socialRepo.unfollow(db, actor.userId, targetUserId);
}

// -- Close friends (Plus; tier gate enforced in the route) ------------------

export async function addCloseFriend(
  db: Db,
  actor: EventActor,
  targetUserId: string,
): Promise<void> {
  if (targetUserId === actor.userId) {
    throw domainErrors.validation("You cannot add yourself as a close friend.");
  }
  const [target] = await db
    .select({ id: authUser.id })
    .from(authUser)
    .where(eq(authUser.id, targetUserId))
    .limit(1);
  if (!target) throw domainErrors.notFound("User not found.");
  await socialRepo.addCloseFriend(db, actor.userId, targetUserId);
}

export async function removeCloseFriend(
  db: Db,
  actor: EventActor,
  targetUserId: string,
): Promise<void> {
  await socialRepo.removeCloseFriend(db, actor.userId, targetUserId);
}

// -- Reading lists ----------------------------------------------------------

export async function createList(
  db: Db,
  actor: EventActor,
  input: Parameters<typeof socialRepo.createList>[2],
): Promise<socialRepo.ReadingList> {
  const list = await socialRepo.createList(db, actor.userId, input);
  // A public list is a feed-worthy event; private lists stay silent.
  if (list.isPublic) {
    await emit(db, "list.created", actor, { listId: list.id, title: list.title });
  }
  return list;
}

async function requireOwnedList(
  db: Db,
  actor: EventActor,
  listId: string,
): Promise<socialRepo.ReadingList> {
  const list = await socialRepo.getListById(db, listId);
  if (!list) throw domainErrors.notFound("List not found.");
  if (list.userId !== actor.userId) throw domainErrors.forbidden("This is not your list.");
  return list;
}

export async function updateList(
  db: Db,
  actor: EventActor,
  listId: string,
  patch: Parameters<typeof socialRepo.updateList>[2],
): Promise<socialRepo.ReadingList> {
  const before = await requireOwnedList(db, actor, listId);
  const updated = await socialRepo.updateList(db, listId, patch);
  if (!updated) throw domainErrors.notFound("List not found.");
  // Emit list_created when a list becomes public for the first time.
  if (!before.isPublic && updated.isPublic) {
    await emit(db, "list.created", actor, { listId: updated.id, title: updated.title });
  }
  return updated;
}

export async function deleteList(db: Db, actor: EventActor, listId: string): Promise<void> {
  await requireOwnedList(db, actor, listId);
  await socialRepo.deleteList(db, listId);
}

export async function addBookToList(
  db: Db,
  actor: EventActor,
  listId: string,
  input: Parameters<typeof socialRepo.addBookToList>[2],
): Promise<socialRepo.ReadingListBook> {
  await requireOwnedList(db, actor, listId);
  const [exists] = await db
    .select({ id: books.id })
    .from(books)
    .where(eq(books.id, input.bookId))
    .limit(1);
  if (!exists) throw domainErrors.notFound("Book not found.");
  return socialRepo.addBookToList(db, listId, input);
}

export async function removeBookFromList(
  db: Db,
  actor: EventActor,
  listId: string,
  bookId: string,
): Promise<void> {
  await requireOwnedList(db, actor, listId);
  await socialRepo.removeBookFromList(db, listId, bookId);
}

// -- Feed assembly ----------------------------------------------------------
// Load both relationship graphs, fetch candidate activity + the viewer's own
// new_follower notifications, resolve visibility (pure), merge by created_at, page.

export type FeedPage = { items: FeedItem[]; nextCursor: number | null };

export async function getFeed(
  db: Db,
  viewerId: string,
  opts: { cursor?: number | null; limit?: number } = {},
): Promise<FeedPage> {
  const limit = Math.min(opts.limit ?? 30, 100);
  const [followingIds, closeFriendAuthorIds] = await Promise.all([
    socialRepo.listFollowingIds(db, viewerId),
    socialRepo.listCloseFriendOfIds(db, viewerId),
  ]);

  const authorIds = [...new Set([...followingIds, ...closeFriendAuthorIds])];
  // Over-fetch candidates because some will be filtered out by visibility.
  const [candidates, followerNotifs] = await Promise.all([
    socialRepo.listActivityByAuthors(db, authorIds, { cursor: opts.cursor, limit: limit * 3 }),
    socialRepo.listFollowerNotifications(db, viewerId, { cursor: opts.cursor, limit }),
  ]);

  const visible = resolveFeed({ viewerId, followingIds, closeFriendAuthorIds, events: candidates });

  const items: FeedItem[] = [
    ...visible.map((event) => ({ kind: "activity" as const, event })),
    ...followerNotifs.map((notification) => ({
      kind: "follower" as const,
      notification,
      createdAt: notification.createdAt,
    })),
  ];
  items.sort((a, b) => tsOf(b) - tsOf(a));

  const page = items.slice(0, limit);
  const nextCursor = page.length === limit ? tsOf(page[page.length - 1]) : null;
  return { items: page, nextCursor };
}

function tsOf(item: FeedItem): number {
  return item.kind === "activity"
    ? (item.event.createdAt?.getTime() ?? 0)
    : (item.createdAt?.getTime() ?? 0);
}

// -- Public profile bundle helpers ------------------------------------------

/** Visibilities a viewer may see of a target's content. Owner sees all; a viewer who is
 *  on the target's close-friends list sees friends+public; everyone else sees public. */
export async function visibleVisibilitiesFor(
  db: Db,
  targetUserId: string,
  viewerId: string | null,
): Promise<string[]> {
  if (viewerId && viewerId === targetUserId) return ["private", "friends", "public"];
  if (viewerId) {
    const closeFriendIds = await socialRepo.listCloseFriendIds(db, targetUserId);
    if (closeFriendIds.includes(viewerId)) return ["friends", "public"];
  }
  return ["public"];
}
