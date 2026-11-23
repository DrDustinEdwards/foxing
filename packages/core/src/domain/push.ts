// Push delivery gate (Phase 7, D18). Pure decision logic: given a notification type, the
// user's notification_prefs, and their timezone, decide whether a PUSH should go out now.
// In-app notifications always land (written by the event emitter); this gate only governs
// the Expo push. Unit-tested without any I/O -- the queue consumer supplies nowUtcMs.
//
// Categories collapse the notification types into the D18 preference switches. "Quiet
// defaults": high-signal categories default on, noisy ones (reactions, poll activity)
// default off, so an unconfigured user is not spammed.

export type QuietHours = { start: string; end: string } | null | undefined;
export type NotificationPrefs = {
  categories?: Record<string, boolean>;
  quietHours?: QuietHours;
};

export const PUSH_CATEGORIES = [
  "streak",
  "club_replies",
  "meetings",
  "announcements",
  "follows",
  "reactions",
  "club_activity",
  "club_admin",
  "milestones",
] as const;
export type PushCategory = (typeof PUSH_CATEGORIES)[number];

const CATEGORY_DEFAULT: Record<PushCategory, boolean> = {
  streak: true,
  club_replies: true,
  meetings: true,
  announcements: true,
  follows: true,
  reactions: false, // noisy
  club_activity: false, // poll churn is noisy
  club_admin: true,
  milestones: true,
};

const TYPE_TO_CATEGORY: Record<string, PushCategory> = {
  streak_at_risk: "streak",
  thread_reply: "club_replies",
  post_reply: "club_replies",
  meeting_reminder: "meetings",
  announcement: "announcements",
  new_follower: "follows",
  reaction: "reactions",
  poll: "club_activity",
  club_request: "club_admin",
  club_approval: "club_admin",
  goal_met: "milestones",
  badge_earned: "milestones",
};

export function pushCategoryFor(notificationType: string): PushCategory | null {
  return TYPE_TO_CATEGORY[notificationType] ?? null;
}

export function categoryEnabled(category: PushCategory, prefs?: NotificationPrefs | null): boolean {
  const override = prefs?.categories?.[category];
  if (typeof override === "boolean") return override;
  return CATEGORY_DEFAULT[category];
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h % 24) * 60 + (m % 60);
}

/** Local minutes-since-midnight in the given IANA timezone, from a UTC epoch ms. Uses
 *  Intl (available in Workers); no tz database bundled. */
export function localMinutes(nowUtcMs: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(nowUtcMs));
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

export function inQuietHours(nowUtcMs: number, timezone: string, quiet: QuietHours): boolean {
  if (!quiet?.start || !quiet?.end) return false;
  const now = localMinutes(nowUtcMs, timezone);
  const start = hhmmToMinutes(quiet.start);
  const end = hhmmToMinutes(quiet.end);
  if (start === end) return false;
  // Window wraps past midnight when start > end (e.g. 22:00 -> 07:00).
  return start < end ? now >= start && now < end : now >= start || now < end;
}

export type PushDecision = {
  deliver: boolean;
  reason: "ok" | "unknown_category" | "category_off" | "quiet_hours";
};

export function shouldDeliverPush(input: {
  notificationType: string;
  prefs?: NotificationPrefs | null;
  timezone?: string | null;
  nowUtcMs: number;
}): PushDecision {
  const category = pushCategoryFor(input.notificationType);
  if (!category) return { deliver: false, reason: "unknown_category" };
  if (!categoryEnabled(category, input.prefs)) return { deliver: false, reason: "category_off" };
  if (inQuietHours(input.nowUtcMs, input.timezone ?? "UTC", input.prefs?.quietHours)) {
    return { deliver: false, reason: "quiet_hours" };
  }
  return { deliver: true, reason: "ok" };
}
