import type { BookRef, ProfileSummary } from "./common";

export type ClubRole = "owner" | "moderator" | "member";

export type ClubMemberStatus =
  | "active"
  | "invited"
  | "requested"
  | "waitlisted"
  | "banned"
  | "left";

export type RsvpStatus = "going" | "maybe" | "not_going";

export interface ClubCard {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  coverUrl: string | null;
  visibility: "public" | "private";
  isVerified: boolean;
  memberCount: number;
  currentBook: BookRef | null;
}

export interface ClubInfo extends ClubCard {
  creatorId: string;
  clubType: string;
  memberApproval: boolean;
  readingPace: string | null;
  chaptersPerWeek: number | null;
  genreTags: string[];
  /** Only moderators see the invite code. */
  joinCode: string | null;
  createdAt: number;
}

export interface ClubMembership {
  status: ClubMemberStatus;
  role: ClubRole;
}

export interface ClubThreadItem {
  id: string;
  title: string;
  type: "discussion" | "announcement";
  chapter: string | null;
  isPinned: boolean;
  isAiStarter: boolean;
  hasSpoilers: boolean;
  author: ProfileSummary | null;
  createdAt: number;
}

export interface ClubMemberItem {
  userId: string;
  profile: ProfileSummary | null;
  role: ClubRole;
  status: ClubMemberStatus;
  joinedAt: number | null;
  /** Moderators only, like the ban details below. */
  mutedUntil?: number | null;
  bannedAt?: number | null;
  banReason?: string | null;
}

export interface ClubPollItem {
  id: string;
  title: string;
  description: string | null;
  pollType: "single" | "irv";
  options: { id: string; label: string; bookId?: string }[];
  closesAt: number | null;
  isClosed: boolean;
  createdBy: string;
  /** First-preference counts by option id. */
  tallies: Record<string, number>;
  voteCount: number;
  myVote: string[] | null;
}

export interface ClubMeetingItem {
  id: string;
  title: string;
  description: string | null;
  meetingDate: number;
  endDate: number | null;
  meetingType: string;
  locationName: string | null;
  locationUrl: string | null;
  isCancelled: boolean;
  rsvps: Record<RsvpStatus, number>;
  myRsvp: RsvpStatus | null;
}

export interface ClubScheduleItem {
  id: string;
  chapterName: string;
  unlockDate: number;
}

/** Everything the club page shows. Public clubs are readable by anyone signed in;
 *  a private club is not found for anyone but its active members. */
export interface ClubPage {
  club: ClubInfo;
  membership: ClubMembership | null;
  isMember: boolean;
  isModerator: boolean;
  threads: ClubThreadItem[];
  members: ClubMemberItem[];
  polls: ClubPollItem[];
  meetings: ClubMeetingItem[];
  schedule: ClubScheduleItem[];
}

export interface ClubPostItem {
  id: string;
  parentPostId: string | null;
  content: string;
  hasSpoiler: boolean;
  isEdited: boolean;
  isPinned: boolean;
  author: ProfileSummary | null;
  createdAt: number;
}

export interface ThreadPage {
  club: { id: string; slug: string | null; name: string };
  isMember: boolean;
  thread: ClubThreadItem & { bookId: string | null };
  posts: ClubPostItem[];
}

export interface ClubsIndex {
  mine: ClubCard[];
  discover: ClubCard[];
}

/** The keepalive frames of a club's live socket. The ClubRoom registers this exact
 *  pair with setWebSocketAutoResponse, so the runtime answers a ping without waking
 *  the object; the match is on the exact string, so both sides import these. */
export const PING_FRAME = JSON.stringify({ t: "ping" });

export const PONG_FRAME = JSON.stringify({ t: "pong" });

/** What the server sends down a club's socket. Every real write goes through
 *  /api/v1; the socket only tells open screens that something changed. */
export type ClubLiveMessage =
  | { t: "presence"; users: string[] }
  | { t: "post"; post: { id: string; threadId: string } }
  | { t: "thread"; thread: { id: string } }
  | { t: "tally"; poll_id: string; tallies: Record<string, number>; closed?: boolean }
  | { t: "notice"; kind: string; [k: string]: unknown }
  | { t: "pong" };
