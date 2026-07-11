// Server-side event emitter. emit(db, event, actor, payload) writes activity_events
// and/or notifications in one D1 batch. Events are emitted ONLY on core write paths,
// never by clients, so web/mobile feeds stay in parity by construction.
//
// Phase 1 registers exactly one real handler (profile.onboarded) to establish the
// pattern; later phases add handlers per the event catalog in spec-cf-api.md.
import type { BatchItem } from "drizzle-orm/batch";
import type { Db } from "../db";
import { activityEvents, notifications } from "../schema";
import type { ActivityType, NotificationType } from "../enums";

export type EventActor = { userId: string; timezone?: string | null };

type ActivityWrite = {
  type: ActivityType;
  bookId?: string | null;
  targetId?: string | null;
  data: Record<string, unknown>;
  visibility?: string;
};

type NotificationWrite = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  data?: Record<string, unknown> | null;
};

/** What a handler produces: rows to write for this event. */
export type EmitResult = {
  activity?: ActivityWrite;
  notifications?: NotificationWrite[];
};

/** The registry maps an event name to the rows it produces. Extend per phase. */
export type EventHandlers = Record<string, (actor: EventActor, payload: unknown) => EmitResult>;

const handlers: EventHandlers = {
  "profile.onboarded": (_actor, payload) => {
    const { username } = payload as { username: string };
    return {
      activity: {
        type: "profile_onboarded",
        data: { username },
        visibility: "public",
      },
    };
  },

  "library.status.reading": (_actor, payload) => {
    const { bookId, title } = payload as { bookId: string; title: string };
    return { activity: { type: "started_book", bookId, data: { title }, visibility: "public" } };
  },

  "library.status.finished": (_actor, payload) => {
    const { bookId, title } = payload as { bookId: string; title: string };
    return { activity: { type: "finished_book", bookId, data: { title }, visibility: "public" } };
  },

  "goal.met": (actor, payload) => {
    const { goalId, goalType, target } = payload as {
      goalId: string;
      goalType: string;
      target: number;
    };
    return {
      activity: {
        type: "goal_met",
        targetId: goalId,
        data: { goalType, target },
        visibility: "public",
      },
      notifications: [
        {
          userId: actor.userId,
          type: "goal_met",
          title: "Goal reached",
          body: `You reached your goal of ${target} ${goalType}.`,
        },
      ],
    };
  },

  // -- Clubs (Phase 5). Recipient lists are passed IN the payload: handlers stay pure
  // (no DB reads), so the domain layer loads active members and hands them here.

  "club.member.joined": (_actor, payload) => {
    const { clubId, clubName } = payload as { clubId: string; clubName: string };
    return {
      activity: { type: "joined_club", targetId: clubId, data: { clubName }, visibility: "public" },
    };
  },

  "club.join.requested": (_actor, payload) => {
    const { clubName, ownerId } = payload as { clubName: string; ownerId: string };
    return {
      notifications: [
        {
          userId: ownerId,
          type: "club_request",
          title: "New join request",
          body: `Someone asked to join ${clubName}.`,
        },
      ],
    };
  },

  "club.member.approved": (actor, payload) => {
    const { clubId, clubName } = payload as { clubId: string; clubName: string };
    return {
      activity: { type: "joined_club", targetId: clubId, data: { clubName }, visibility: "public" },
      notifications: [
        {
          userId: actor.userId,
          type: "club_approval",
          title: "Request approved",
          body: `You are now a member of ${clubName}.`,
        },
      ],
    };
  },

  "club.thread.announced": (_actor, payload) => {
    const { recipientIds, clubName, threadTitle, threadId } = payload as {
      recipientIds: string[];
      clubName: string;
      threadTitle: string;
      threadId: string;
    };
    return {
      notifications: recipientIds.map((userId) => ({
        userId,
        type: "announcement" as const,
        title: `New announcement in ${clubName}`,
        body: threadTitle,
        data: { threadId },
      })),
    };
  },

  "club.post.created": (_actor, payload) => {
    const { notify, threadId, threadTitle } = payload as {
      notify: { userId: string; type: "thread_reply" | "post_reply" }[];
      threadId: string;
      threadTitle: string;
    };
    return {
      notifications: notify.map((n) => ({
        userId: n.userId,
        type: n.type,
        title: n.type === "thread_reply" ? "New reply in your thread" : "Someone replied to you",
        body: threadTitle,
        data: { threadId },
      })),
    };
  },

  "club.poll.created": (_actor, payload) => {
    const { recipientIds, clubName, pollTitle, pollId } = payload as {
      recipientIds: string[];
      clubName: string;
      pollTitle: string;
      pollId: string;
    };
    return {
      notifications: recipientIds.map((userId) => ({
        userId,
        type: "poll" as const,
        title: `New poll in ${clubName}`,
        body: pollTitle,
        data: { pollId },
      })),
    };
  },

  "club.poll.closed": (_actor, payload) => {
    const { recipientIds, pollId, pollTitle, result } = payload as {
      recipientIds: string[];
      pollId: string;
      pollTitle: string;
      result: unknown;
    };
    return {
      notifications: recipientIds.map((userId) => ({
        userId,
        type: "poll" as const,
        title: "Poll closed",
        body: pollTitle,
        data: { pollId, result },
      })),
    };
  },

  "club.meeting.created": (_actor, payload) => {
    const { recipientIds, clubName, meetingTitle, meetingId } = payload as {
      recipientIds: string[];
      clubName: string;
      meetingTitle: string;
      meetingId: string;
    };
    return {
      notifications: recipientIds.map((userId) => ({
        userId,
        type: "meeting_reminder" as const,
        title: `New meeting in ${clubName}`,
        body: meetingTitle,
        data: { meetingId },
      })),
    };
  },

  // -- Social (Phase 6). Diary events carry the ENTRY's own visibility (private entries
  // emit no event at all, so the domain never calls these for a private entry). The feed
  // resolver later filters by that stored visibility per viewer.

  "follow.created": (_actor, payload) => {
    // Notification to the followed user; there is no feed activity for a follow (the
    // followed user sees it as a new_follower item, sourced from notifications).
    const { followingId } = payload as { followingId: string; followerName?: string };
    return {
      notifications: [
        {
          userId: followingId,
          type: "new_follower",
          title: "New follower",
          body: "Someone started following you.",
        },
      ],
    };
  },

  "diary.rated": (_actor, payload) => {
    const { bookId, title, ratingHalf, visibility, diaryId } = payload as {
      bookId: string;
      title: string;
      ratingHalf: number;
      visibility: string;
      diaryId: string;
    };
    return {
      activity: {
        type: "rated",
        bookId,
        targetId: diaryId,
        data: { title, ratingHalf },
        visibility,
      },
    };
  },

  "diary.reviewed": (_actor, payload) => {
    const { bookId, title, ratingHalf, visibility, diaryId } = payload as {
      bookId: string;
      title: string;
      ratingHalf: number | null;
      visibility: string;
      diaryId: string;
    };
    return {
      activity: {
        type: "reviewed",
        bookId,
        targetId: diaryId,
        data: { title, ratingHalf },
        visibility,
      },
    };
  },

  "list.created": (_actor, payload) => {
    // Only public lists reach here (the domain skips the emit for private lists).
    const { listId, title } = payload as { listId: string; title: string };
    return {
      activity: { type: "list_created", targetId: listId, data: { title }, visibility: "public" },
    };
  },

  "reaction.created": (_actor, payload) => {
    // Notification to the target owner (never self; the domain drops self-reactions).
    const { ownerId, targetType, targetId, kind } = payload as {
      ownerId: string;
      targetType: string;
      targetId: string;
      kind: string;
    };
    return {
      notifications: [
        {
          userId: ownerId,
          type: "reaction",
          title: "New reaction",
          body: null,
          data: { targetType, targetId, kind },
        },
      ],
    };
  },
};

export async function emit(
  db: Db,
  event: string,
  actor: EventActor,
  payload?: unknown,
): Promise<void> {
  const handler = handlers[event];
  if (!handler) return; // unregistered events are a no-op in the skeleton

  const result = handler(actor, payload);
  const stmts: BatchItem<"sqlite">[] = [];

  if (result.activity) {
    stmts.push(
      db.insert(activityEvents).values({
        userId: actor.userId,
        type: result.activity.type,
        bookId: result.activity.bookId ?? null,
        targetId: result.activity.targetId ?? null,
        data: result.activity.data,
        visibility: result.activity.visibility ?? "public",
      }),
    );
  }
  for (const n of result.notifications ?? []) {
    stmts.push(
      db.insert(notifications).values({
        userId: n.userId,
        type: n.type,
        title: n.title,
        body: n.body ?? null,
        data: n.data ?? null,
      }),
    );
  }

  if (stmts.length === 0) return;
  await db.batch(stmts as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
}
