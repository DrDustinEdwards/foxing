// Single source of truth for every text-enum column in the schema.
// Schema columns store plain text; these zod enums validate at the core boundary.
// Each `*Values` tuple feeds both a zod enum and (where useful) Drizzle column typing.
// Spec: foxing/spec-cf-schema.md rev 3, foxing/spec-cf-api.md.
import { z } from "zod";

const tuple = <T extends readonly [string, ...string[]]>(v: T) => v;

// -- Catalog ---------------------------------------------------------------
export const sourceTypeValues = tuple(["catalog", "community"] as const);
export const sourceType = z.enum(sourceTypeValues);
export type SourceType = z.infer<typeof sourceType>;

// pacing / reading feel on books (nullable in schema). Inferred set.
export const pacingValues = tuple(["slow", "medium", "fast"] as const);
export const pacing = z.enum(pacingValues);

// book_ai_cache.action (Phase 4 populated). Fixed by spec-cf-schema.
export const bookAiActionValues = tuple([
  "book_description",
  "author_bio",
  "similar_books",
  "reading_order",
  "discussion_guide",
] as const);
export const bookAiAction = z.enum(bookAiActionValues);

// -- Profiles / tiers ------------------------------------------------------
export const subscriptionTierValues = tuple(["free", "plus"] as const);
export const subscriptionTier = z.enum(subscriptionTierValues);
export type SubscriptionTier = z.infer<typeof subscriptionTier>;

// -- Library / tracking ----------------------------------------------------
export const userBookStatusValues = tuple([
  "want",
  "reading",
  "finished",
  "paused",
  "abandoned",
] as const);
export const userBookStatus = z.enum(userBookStatusValues);
export type UserBookStatus = z.infer<typeof userBookStatus>;

// diary_entries.visibility
export const diaryVisibilityValues = tuple(["private", "friends", "public"] as const);
export const diaryVisibility = z.enum(diaryVisibilityValues);

// reading_goals.type / period_type. Inferred (spec leaves shape open).
export const goalTypeValues = tuple(["books", "pages", "minutes"] as const);
export const goalType = z.enum(goalTypeValues);
export const goalPeriodValues = tuple(["year", "month", "week"] as const);
export const goalPeriod = z.enum(goalPeriodValues);

// -- Annotations layer -----------------------------------------------------
export const annotationTypeValues = tuple([
  "highlight",
  "note",
  "bookmark",
  "comment",
  "commonplace",
] as const);
export const annotationType = z.enum(annotationTypeValues);
export type AnnotationType = z.infer<typeof annotationType>;

// annotation.visibility. Extension point for the future Edu class layer.
export const annotationVisibilityValues = tuple(["private", "friends", "club", "public"] as const);
export const annotationVisibility = z.enum(annotationVisibilityValues);
export type AnnotationVisibility = z.infer<typeof annotationVisibility>;

// The 7 semantic highlight colors (highlight type only). Canonical names from
// design-system.md ("Annotation Highlight Colors": --hl-* tokens); identical to
// the mobile palette keys so annotations.color round-trips web <-> mobile.
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

// reactions.target_type
export const reactionTargetValues = tuple([
  "annotation",
  "club_post",
  "club_thread",
  "diary_entry",
  "reading_list",
  "journal_post",
] as const);
export const reactionTarget = z.enum(reactionTargetValues);

// saves.target_type (generalized). Inferred superset.
export const saveTargetValues = tuple([
  "annotation",
  "club_post",
  "club_thread",
  "journal_post",
  "reading_list",
  "book",
] as const);
export const saveTarget = z.enum(saveTargetValues);

// -- Clubs -----------------------------------------------------------------
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

// club_meetings.meeting_type + rsvp status. Inferred.
export const meetingTypeValues = tuple(["virtual", "in_person", "hybrid"] as const);
export const meetingType = z.enum(meetingTypeValues);
export const rsvpStatusValues = tuple(["going", "maybe", "not_going"] as const);
export const rsvpStatus = z.enum(rsvpStatusValues);

// -- Platform --------------------------------------------------------------
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

// push_tokens.platform
export const pushPlatformValues = tuple(["ios", "android"] as const);
export const pushPlatform = z.enum(pushPlatformValues);

// companion_messages.role
export const companionRoleValues = tuple(["user", "assistant"] as const);
export const companionRole = z.enum(companionRoleValues);

// -- Events / notifications ------------------------------------------------
// activity_events.type. Emitted only by the core event emitter on write paths.
// Extensible: add a value here when a new emit() call needs it.
export const activityTypeValues = tuple([
  "started_book",
  "finished_book",
  "rated",
  "reviewed",
  "highlighted",
  "goal_met",
  "badge_earned",
  "joined_club",
  "list_created",
  "profile_onboarded",
] as const);
export const activityType = z.enum(activityTypeValues);
export type ActivityType = z.infer<typeof activityType>;

// notifications.type
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
