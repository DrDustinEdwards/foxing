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
