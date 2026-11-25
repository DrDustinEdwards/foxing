import type { BookCard, BookRef, ProfileSummary, Visibility } from "./common";

export type FeedRow =
  | {
      kind: "activity";
      id: string;
      type: string;
      actor: ProfileSummary | null;
      book: { id: string; title: string; slug: string; coverUrl: string | null } | null;
      data: Record<string, unknown>;
      createdAt: number;
    }
  | { kind: "follower"; id: string; actorLabel: string; createdAt: number };

export interface FeedPage {
  rows: FeedRow[];
  /** `<ms>.<id>` of the last row (site-runtime ./d1 encodeCursor), or null on the last page. */
  nextCursor: string | null;
}

export interface ProfileBook {
  bookId: string;
  title: string;
  author: string;
  slug: string;
  coverUrl: string | null;
}

export interface DiaryEntry {
  id: string;
  bookId: string;
  book: BookRef | null;
  ratingHalf: number | null;
  review: string | null;
  containsSpoilers: boolean;
  visibility: Visibility;
  logDate: number | null;
}

export interface ListSummary {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  isPublic: boolean;
}

export interface MyList {
  id: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  bookCount: number;
  covers: string[];
}

export interface ActivityItem {
  id: string;
  type: string;
  bookId: string | null;
  data: Record<string, unknown>;
  visibility: Visibility;
  createdAt: number;
}

export interface PublicProfile {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  favoriteGenres: string[];
  createdAt: number | null;
}

/** A profile page. A non-public profile is only its identity, to all but its owner. */
export type ProfilePage =
  | {
      isPrivate: true;
      profile: { username: string; displayName: string | null; avatarUrl: string | null };
    }
  | {
      isPrivate: false;
      profile: PublicProfile;
      isOwner: boolean;
      isFollowing: boolean;
      viewerHasAsCloseFriend: boolean;
      followerCount: number;
      followingCount: number;
      booksRead: number;
      highlightCount: number;
      publicShelves: { id: string; name: string; bookCount: number }[];
      finishedBooks: ProfileBook[];
      publicHighlights: {
        id: string;
        selectedText: string | null;
        bookTitle: string | null;
        bookSlug: string | null;
      }[];
      /** Empty when progress is private and the viewer is not the owner. */
      currentlyReading: (ProfileBook & { progressPct: number })[];
      diary: DiaryEntry[];
      lists: ListSummary[];
      activity: ActivityItem[];
    };

export interface PeoplePage {
  following: (ProfileSummary & { isClose: boolean })[];
  followers: (ProfileSummary & { isFollowing: boolean })[];
  closeFriends: ProfileSummary[];
}

export interface ListPage {
  list: { id: string; title: string; description: string | null; isPublic: boolean };
  isOwner: boolean;
  owner: ProfileSummary | null;
  likeCount: number;
  liked: boolean;
  books: { bookId: string; note: string | null; position: number; book: BookCard | null }[];
}
