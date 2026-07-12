// Social read plumbing for loaders (Phase 6). Reads run in-process via core (the
// standing rule: loaders never self-fetch the Worker's own /api/v1). Writes go to
// /api/v1 from the browser and the page revalidates. Feed visibility resolves entirely
// server-side in core (socialDomain.getFeed / visibleVisibilitiesFor); the loader never
// re-implements it. Kept React-free so the shapes are unit/integration testable.
import {
  annotationsRepo,
  catalogRepo,
  createDb,
  diaryRepo,
  libraryRepo,
  profilesRepo,
  recapDomain,
  socialDomain,
  socialRepo,
  reactionsRepo,
} from "@foxing/core";
import type { ProfileSummary, Recap } from "@foxing/core";

export type FeedActor = ProfileSummary;
export type FeedBook = { id: string; title: string; slug: string; coverUrl: string | null } | null;

export type FeedRow =
  | {
      kind: "activity";
      id: string;
      type: string;
      actor: FeedActor | null;
      book: FeedBook;
      data: Record<string, unknown>;
      createdAt: number;
    }
  | {
      kind: "follower";
      id: string;
      actorLabel: string;
      createdAt: number;
    };

/** The viewer's activity feed, enriched with actor identity + book cards. */
export async function loadFeed(env: Env, viewerId: string, cursor: number | null) {
  const db = createDb(env.DB);
  const page = await socialDomain.getFeed(db, viewerId, { cursor });

  const actorIds = new Set<string>();
  const bookIds = new Set<string>();
  for (const item of page.items) {
    if (item.kind === "activity") {
      actorIds.add(item.event.userId);
      if (item.event.bookId) bookIds.add(item.event.bookId);
    }
  }
  const [actors, books] = await Promise.all([
    profilesRepo.getProfileSummaries(db, [...actorIds]),
    catalogRepo.getBooksByIds(db, [...bookIds]),
  ]);
  const bookMap = new Map(books.map((b) => [b.id, b]));

  const rows: FeedRow[] = page.items.map((item) => {
    if (item.kind === "activity") {
      const e = item.event;
      const b = e.bookId ? bookMap.get(e.bookId) : undefined;
      return {
        kind: "activity",
        id: e.id,
        type: e.type,
        actor: actors.get(e.userId) ?? null,
        book: b ? { id: b.id, title: b.title, slug: b.slug, coverUrl: b.coverUrl } : null,
        data: (e.data ?? {}) as Record<string, unknown>,
        createdAt: e.createdAt?.getTime() ?? 0,
      };
    }
    return {
      kind: "follower",
      id: item.notification.id,
      actorLabel: item.notification.body ?? "Someone started following you.",
      createdAt: item.createdAt?.getTime() ?? 0,
    };
  });

  return { rows, nextCursor: page.nextCursor };
}

// -- Public profile bundle --------------------------------------------------

export async function loadPublicProfile(env: Env, username: string, viewerId: string | null) {
  const db = createDb(env.DB);
  const profile = await profilesRepo.getProfileByUsername(db, username);
  if (!profile) return null;

  const profileVis = profile.visibility?.profile ?? "public";
  const isOwner = viewerId === profile.id;
  // A non-public profile shows a branded "private" notice to everyone but its owner,
  // with just enough identity to confirm the account exists. Full data stays hidden.
  if (!isOwner && profileVis !== "public") {
    return {
      isPrivate: true as const,
      profile: {
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
      },
    };
  }

  // Currently-reading is gated on the owner's progress visibility (a public/private
  // toggle in settings). Private means only the owner sees it. This is the read-side
  // consumption of profiles.visibility.progress, which settings writes.
  const progressVis = profile.visibility?.progress ?? "public";
  const showProgress = isOwner || progressVis !== "private";

  const allowed = await socialDomain.visibleVisibilitiesFor(db, profile.id, viewerId);
  const [
    diary,
    lists,
    activity,
    followerCount,
    followingCount,
    isFollowing,
    viewer,
    closeFriendIds,
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
    viewerId ? socialRepo.isFollowing(db, viewerId, profile.id) : Promise.resolve(false),
    viewerId ? profilesRepo.getProfileById(db, viewerId) : Promise.resolve(null),
    viewerId ? socialRepo.listCloseFriendIds(db, viewerId) : Promise.resolve([] as string[]),
    showProgress
      ? libraryRepo.listCurrentlyReading(db, profile.id, 6)
      : Promise.resolve([] as Awaited<ReturnType<typeof libraryRepo.listCurrentlyReading>>),
    libraryRepo.countFinishedBooks(db, profile.id),
    annotationsRepo.countPublicHighlights(db, profile.id),
    libraryRepo.listFavoriteBooks(db, profile.id, 5),
    libraryRepo.listPublicShelves(db, profile.id),
    libraryRepo.listFinishedBooks(db, profile.id, 8),
    annotationsRepo.listPublicHighlights(db, profile.id, 6),
  ]);

  // Overlay diary entries with their book card.
  const diaryBooks = await catalogRepo.getBooksByIds(db, [...new Set(diary.map((d) => d.bookId))]);
  const diaryBookMap = new Map(diaryBooks.map((b) => [b.id, b]));

  return {
    isPrivate: false as const,
    profile: {
      id: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      bio: profile.bio,
      favoriteGenres: profile.favoriteGenres ?? [],
      createdAt: profile.createdAt?.getTime() ?? null,
    },
    isOwner,
    isFollowing,
    viewerIsPlus: viewer?.subscriptionTier === "plus",
    viewerHasAsCloseFriend: closeFriendIds.includes(profile.id),
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
    // Empty when progress is private and the viewer is not the owner.
    currentlyReading: currentlyReading.map((b) => ({
      bookId: b.bookId,
      title: b.title,
      author: b.author,
      slug: b.slug,
      coverUrl: b.coverUrl,
      progressPct: b.progressPct,
    })),
    diary: diary.map((d) => ({
      id: d.id,
      bookId: d.bookId,
      book: diaryBookMap.get(d.bookId) ?? null,
      ratingHalf: d.ratingHalf,
      review: d.review,
      containsSpoilers: d.containsSpoilers,
      visibility: d.visibility,
      logDate: d.logDate?.getTime() ?? null,
    })),
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
      visibility: a.visibility,
      createdAt: a.createdAt?.getTime() ?? 0,
    })),
  };
}

// -- Own diary --------------------------------------------------------------

export type OwnDiaryEntry = {
  id: string;
  bookId: string;
  book: { title: string; slug: string; coverUrl: string | null } | null;
  ratingHalf: number | null;
  review: string | null;
  containsSpoilers: boolean;
  visibility: string;
  logDate: number | null;
};

/** The signed-in reader's own reading log, newest-logged first, all visibilities (it is
 *  theirs). Reuses the same diary query + book overlay the public profile uses. */
export async function loadOwnDiary(env: Env, userId: string): Promise<OwnDiaryEntry[]> {
  const db = createDb(env.DB);
  const entries = await diaryRepo.listEntriesForUser(
    db,
    userId,
    ["private", "friends", "public"],
    { limit: 100 },
  );
  const books = await catalogRepo.getBooksByIds(db, [...new Set(entries.map((e) => e.bookId))]);
  const bookMap = new Map(books.map((b) => [b.id, b]));
  return entries.map((d) => {
    const b = bookMap.get(d.bookId);
    return {
      id: d.id,
      bookId: d.bookId,
      book: b ? { title: b.title, slug: b.slug, coverUrl: b.coverUrl } : null,
      ratingHalf: d.ratingHalf,
      review: d.review,
      containsSpoilers: d.containsSpoilers,
      visibility: d.visibility,
      logDate: d.logDate?.getTime() ?? null,
    };
  });
}

// -- People (follow discovery) ----------------------------------------------

export async function loadPeople(env: Env, viewerId: string) {
  const db = createDb(env.DB);
  const [followingIds, followerIds, closeFriendIds] = await Promise.all([
    socialRepo.listFollowingIds(db, viewerId),
    socialRepo.listFollowerIds(db, viewerId),
    socialRepo.listCloseFriendIds(db, viewerId),
  ]);
  const all = [...new Set([...followingIds, ...followerIds, ...closeFriendIds])];
  const summaries = await profilesRepo.getProfileSummaries(db, all);
  const pick = (ids: string[]) =>
    ids.map((id) => summaries.get(id)).filter(Boolean) as ProfileSummary[];
  const followingSet = new Set(followingIds);
  const closeFriendSet = new Set(closeFriendIds);
  return {
    following: pick(followingIds),
    followers: pick(followerIds).map((p) => ({ ...p, isFollowing: followingSet.has(p.id) })),
    closeFriends: pick(closeFriendIds),
    closeFriendIds: closeFriendSet,
  };
}

/** Just the viewer's close friends, resolved to summaries. Used by the settings section,
 *  which lists + removes; adding new close friends happens on /people (follow-graph aware). */
export async function loadCloseFriends(env: Env, viewerId: string): Promise<ProfileSummary[]> {
  const db = createDb(env.DB);
  const ids = await socialRepo.listCloseFriendIds(db, viewerId);
  const summaries = await profilesRepo.getProfileSummaries(db, ids);
  return ids.map((id) => summaries.get(id)).filter(Boolean) as ProfileSummary[];
}

// -- List detail ------------------------------------------------------------

export async function loadListDetail(env: Env, listId: string, viewerId: string | null) {
  const db = createDb(env.DB);
  const list = await socialRepo.getListById(db, listId);
  if (!list) return null;
  const isOwner = viewerId === list.userId;
  if (!list.isPublic && !isOwner) return null;

  const [entries, owner, likeCount, liked] = await Promise.all([
    socialRepo.listBooks(db, list.id),
    profilesRepo.getProfileSummaries(db, [list.userId]),
    reactionsRepo.countReactions(db, "reading_list", list.id, "like"),
    viewerId
      ? reactionsRepo.hasReacted(db, viewerId, "reading_list", list.id, "like")
      : Promise.resolve(false),
  ]);
  const books = await catalogRepo.getBooksByIds(
    db,
    entries.map((e) => e.bookId),
  );
  const bookMap = new Map(books.map((b) => [b.id, b]));

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
      book: bookMap.get(e.bookId) ?? null,
    })),
  };
}

// -- Recap ------------------------------------------------------------------

export async function loadRecap(
  env: Env,
  target: { userId: string } | { username: string },
  year: number,
  viewerId: string | null,
): Promise<{ recap: Recap; displayName: string; username: string } | null> {
  const db = createDb(env.DB);
  let userId: string;
  let username: string;
  let displayName: string;
  if ("userId" in target) {
    const p = await profilesRepo.getProfileById(db, target.userId);
    if (!p) return null;
    userId = p.id;
    username = p.username;
    displayName = p.displayName ?? p.username;
  } else {
    const p = await profilesRepo.getProfileByUsername(db, target.username);
    if (!p) return null;
    const isOwner = viewerId === p.id;
    if (!isOwner && (p.visibility?.profile ?? "public") !== "public") return null;
    userId = p.id;
    username = p.username;
    displayName = p.displayName ?? p.username;
  }
  const recap = await recapDomain.getRecap(db, userId, year);
  return { recap, displayName, username };
}
