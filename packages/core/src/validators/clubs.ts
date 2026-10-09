// Validators for the club write paths (Phase 5). Enums come from the single source
// in enums.ts. Every club write route parses its body through one of these at the
// boundary; core domain functions trust the parsed shape.
import { z } from "zod";
import {
  clubMemberRole,
  clubThreadType,
  clubVisibility,
  meetingType,
  pollType,
  rsvpStatus,
} from "../enums";

// -- Club CRUD --------------------------------------------------------------

export const createClubInput = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(4000).optional(),
  coverUrl: z.string().url().max(2000).optional(),
  visibility: clubVisibility.optional(),
  memberApproval: z.boolean().optional(),
  maxMembers: z.number().int().positive().max(100000).optional(),
  readingPace: z.string().max(120).optional(),
  chaptersPerWeek: z.number().int().positive().max(100).optional(),
  genreTags: z.array(z.string().max(60)).max(20).optional(),
  currentBookId: z.string().min(1).optional(),
});
export type CreateClubInput = z.infer<typeof createClubInput>;

export const updateClubInput = z
  .object({
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(4000).nullable().optional(),
    coverUrl: z.string().url().max(2000).nullable().optional(),
    visibility: clubVisibility.optional(),
    memberApproval: z.boolean().optional(),
    maxMembers: z.number().int().positive().max(100000).nullable().optional(),
    readingPace: z.string().max(120).nullable().optional(),
    chaptersPerWeek: z.number().int().positive().max(100).nullable().optional(),
    genreTags: z.array(z.string().max(60)).max(20).nullable().optional(),
    // A club's current read may be any book already in D1 (catalog or community).
    // Search-to-add a brand-new community book is deferred (see deferred-items.md).
    currentBookId: z.string().min(1).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "no fields to update" });
export type UpdateClubInput = z.infer<typeof updateClubInput>;

// -- Membership -------------------------------------------------------------

// Role change target (approve/ban/unban/mute take no body beyond the path userId).
export const setRoleInput = z.object({
  role: clubMemberRole,
});
export type SetRoleInput = z.infer<typeof setRoleInput>;

export const muteMemberInput = z.object({
  // minutes from now; omit or 0 to unmute.
  minutes: z
    .number()
    .int()
    .min(0)
    .max(60 * 24 * 365),
});
export type MuteMemberInput = z.infer<typeof muteMemberInput>;

// -- Threads + posts --------------------------------------------------------

export const createThreadInput = z.object({
  type: clubThreadType.optional(),
  title: z.string().min(1).max(240),
  bookId: z.string().min(1).optional(),
  chapter: z.string().max(120).optional(),
  hasSpoilers: z.boolean().optional(),
  expiresAt: z.number().int().optional(), // epoch ms, announcements
  // First post body (optional): starting a discussion usually opens with a message.
  body: z.string().min(1).max(20000).optional(),
});
export type CreateThreadInput = z.infer<typeof createThreadInput>;

export const createPostInput = z.object({
  content: z.string().min(1).max(20000),
  parentPostId: z.string().min(1).optional(),
  hasSpoiler: z.boolean().optional(),
});
export type CreatePostInput = z.infer<typeof createPostInput>;

export const removePostInput = z.object({
  reason: z.string().max(500).optional(),
});
export type RemovePostInput = z.infer<typeof removePostInput>;

// -- Polls ------------------------------------------------------------------

const pollOptionInput = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(240),
  bookId: z.string().min(1).optional(),
});

export const createPollInput = z
  .object({
    title: z.string().min(1).max(240),
    description: z.string().max(4000).optional(),
    pollType: pollType.optional(),
    options: z.array(pollOptionInput).min(2).max(20),
    closesAt: z.number().int().optional(), // epoch ms
  })
  .refine((v) => new Set(v.options.map((o) => o.id)).size === v.options.length, {
    message: "option ids must be unique",
    path: ["options"],
  });
export type CreatePollInput = z.infer<typeof createPollInput>;

export const votePollInput = z.object({
  // Ordered option ids. Single-choice polls send exactly one; IRV sends a ranking.
  ranks: z.array(z.string().min(1)).min(1).max(20),
});
export type VotePollInput = z.infer<typeof votePollInput>;

// -- Meetings + RSVPs -------------------------------------------------------

export const createMeetingInput = z.object({
  title: z.string().min(1).max(240),
  description: z.string().max(4000).optional(),
  bookId: z.string().min(1).optional(),
  meetingDate: z.number().int(), // epoch ms
  endDate: z.number().int().optional(),
  meetingType: meetingType.optional(),
  locationName: z.string().max(240).optional(),
  locationAddress: z.string().max(500).optional(),
  locationUrl: z.string().url().max(2000).optional(),
  isRecurring: z.boolean().optional(),
  recurrenceRule: z.string().max(500).optional(),
  rsvpLimit: z.number().int().positive().max(100000).optional(),
});
export type CreateMeetingInput = z.infer<typeof createMeetingInput>;

export const rsvpInput = z.object({
  status: rsvpStatus,
});
export type RsvpInput = z.infer<typeof rsvpInput>;

// -- Schedule ---------------------------------------------------------------

export const createScheduleInput = z.object({
  chapterName: z.string().min(1).max(240),
  unlockDate: z.number().int(), // epoch ms
});
export type CreateScheduleInput = z.infer<typeof createScheduleInput>;
