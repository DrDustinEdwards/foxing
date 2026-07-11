export * as profilesRepo from "./profiles";
export * from "./profiles";

// Catalog reads are namespaced (catalogRepo.getBookBySlug, ...) to keep the many
// function names from colliding across resources as the read layer grows. Types are
// re-exported flat for ergonomic loader typing (import type { BookCard }).
export * as catalogRepo from "./catalog";
export type * from "./catalog";

export * as libraryRepo from "./library";
export type { LibraryEntry, UserBook, CustomShelf, ReadingGoal, ReadingStreak } from "./library";

export * as companionRepo from "./companion";
export type { CompanionThread, CompanionMessageRow, BookAiCacheRow } from "./companion";

export * as billingRepo from "./billing";

export * as clubsRepo from "./clubs";
export type {
  Club,
  ClubMember,
  ClubThread,
  ClubPost,
  ClubPoll,
  ClubPollVote,
  ClubMeeting,
  ClubMeetingRsvp,
  ClubScheduleRow,
} from "./clubs";

export * as socialRepo from "./social";
export type { ReadingList, ReadingListBook, ActivityEvent } from "./social";

export * as diaryRepo from "./diary";
export type { DiaryEntry } from "./diary";

export * as reactionsRepo from "./reactions";
export type { Reaction } from "./reactions";

export * as recapRepo from "./recap";
export type { FinishedBook } from "./recap";
