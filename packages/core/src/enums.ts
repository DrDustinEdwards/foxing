// Single source of truth for every text-enum column; each `*Values` tuple feeds a zod enum and Drizzle column typing.
import { z } from "zod";

const tuple = <T extends readonly [string, ...string[]]>(v: T) => v;

export const sourceTypeValues = tuple(["catalog", "community"] as const);
export const sourceType = z.enum(sourceTypeValues);
export type SourceType = z.infer<typeof sourceType>;

export const pacingValues = tuple(["slow", "medium", "fast"] as const);
export const pacing = z.enum(pacingValues);

export const subscriptionTierValues = tuple(["free", "plus"] as const);
export const subscriptionTier = z.enum(subscriptionTierValues);
export type SubscriptionTier = z.infer<typeof subscriptionTier>;

export const userBookStatusValues = tuple([
  "want",
  "reading",
  "finished",
  "paused",
  "abandoned",
] as const);
export const userBookStatus = z.enum(userBookStatusValues);
export type UserBookStatus = z.infer<typeof userBookStatus>;

export const diaryVisibilityValues = tuple(["private", "friends", "public"] as const);
export const diaryVisibility = z.enum(diaryVisibilityValues);

export const goalTypeValues = tuple(["books", "pages", "minutes"] as const);
export const goalType = z.enum(goalTypeValues);
export const goalPeriodValues = tuple(["year", "month", "week"] as const);
export const goalPeriod = z.enum(goalPeriodValues);

export const annotationTypeValues = tuple([
  "highlight",
  "note",
  "bookmark",
  "comment",
  "commonplace",
] as const);
export const annotationType = z.enum(annotationTypeValues);
export type AnnotationType = z.infer<typeof annotationType>;

export const annotationVisibilityValues = tuple(["private", "friends", "club", "public"] as const);
export const annotationVisibility = z.enum(annotationVisibilityValues);
export type AnnotationVisibility = z.infer<typeof annotationVisibility>;

// The 7 semantic highlight colors; keys match the mobile palette so annotations.color round-trips web <-> mobile.
export const highlightColorValues = tuple([
  "amber",
  "auburn",
  "yellow",
  "sage",
  "cobalt",
  "crimson",
  "purple",
] as const);
export const highlightColor = z.enum(highlightColorValues);
export type HighlightColor = z.infer<typeof highlightColor>;

export const reactionTargetValues = tuple([
  "annotation",
  "club_post",
  "club_thread",
  "diary_entry",
  "reading_list",
  "journal_post",
] as const);
export const reactionTarget = z.enum(reactionTargetValues);

export const saveTargetValues = tuple([
  "annotation",
  "club_post",
  "club_thread",
  "journal_post",
  "reading_list",
  "book",
] as const);
export const saveTarget = z.enum(saveTargetValues);

export const clubTypeValues = tuple(["reader", "bookstore"] as const);
export const clubType = z.enum(clubTypeValues);

export const clubVisibilityValues = tuple(["public", "private"] as const);
export const clubVisibility = z.enum(clubVisibilityValues);

export const clubMemberStatusValues = tuple([
  "active",
  "invited",
  "requested",
  "waitlisted",
  "banned",
  "left",
] as const);
export const clubMemberStatus = z.enum(clubMemberStatusValues);
export type ClubMemberStatus = z.infer<typeof clubMemberStatus>;

export const clubMemberRoleValues = tuple(["owner", "moderator", "member"] as const);
export const clubMemberRole = z.enum(clubMemberRoleValues);
export type ClubMemberRole = z.infer<typeof clubMemberRole>;

export const clubThreadTypeValues = tuple(["discussion", "announcement"] as const);
export const clubThreadType = z.enum(clubThreadTypeValues);

export const pollTypeValues = tuple(["single", "irv"] as const);
export const pollType = z.enum(pollTypeValues);

export const meetingTypeValues = tuple(["virtual", "in_person", "hybrid"] as const);
export const meetingType = z.enum(meetingTypeValues);
export const rsvpStatusValues = tuple(["going", "maybe", "not_going"] as const);
export const rsvpStatus = z.enum(rsvpStatusValues);

export const reportTargetValues = tuple([
  "annotation",
  "club_post",
  "club_thread",
  "diary_entry",
  "reading_list",
  "journal_post",
  "profile",
] as const);
export const reportTarget = z.enum(reportTargetValues);

export const reportStatusValues = tuple(["open", "reviewing", "resolved", "dismissed"] as const);
export const reportStatus = z.enum(reportStatusValues);

export const pushPlatformValues = tuple(["ios", "android"] as const);
export const pushPlatform = z.enum(pushPlatformValues);

export const companionRoleValues = tuple(["user", "assistant"] as const);
export const companionRole = z.enum(companionRoleValues);

// Emitted only by the core event emitter; add a value when a new emit() call needs it.
export const activityTypeValues = tuple([
  "started_book",
  "finished_book",
  "rated",
  "reviewed",
  "highlighted",
  "badge_earned",
  "joined_club",
  "list_created",
  "profile_onboarded",
] as const);
export const activityType = z.enum(activityTypeValues);
export type ActivityType = z.infer<typeof activityType>;

export const notificationTypeValues = tuple([
  "new_follower",
  "club_request",
  "club_approval",
  "club_ownership",
  "thread_reply",
  "post_reply",
  "poll",
  "meeting_reminder",
  "announcement",
  "reaction",
  "badge_earned",
  "goal_met",
  "streak_at_risk",
] as const);
export const notificationType = z.enum(notificationTypeValues);
export type NotificationType = z.infer<typeof notificationType>;
