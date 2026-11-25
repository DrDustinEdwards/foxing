import { z } from "zod";
import { webUrl } from "./web-url";
import {
  clubMemberRole,
  clubThreadType,
  clubVisibility,
  meetingType,
  pollType,
  rsvpStatus,
} from "../enums";

export const createClubInput = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(4000).optional(),
  coverUrl: webUrl().optional(),
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
    coverUrl: webUrl().nullable().optional(),
    visibility: clubVisibility.optional(),
    memberApproval: z.boolean().optional(),
    maxMembers: z.number().int().positive().max(100000).nullable().optional(),
    readingPace: z.string().max(120).nullable().optional(),
    chaptersPerWeek: z.number().int().positive().max(100).nullable().optional(),
    genreTags: z.array(z.string().max(60)).max(20).nullable().optional(),
    // A club's current read may be any book already in D1 (catalog or community).
    currentBookId: z.string().min(1).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "no fields to update" });
export type UpdateClubInput = z.infer<typeof updateClubInput>;

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

export const banMemberInput = z.object({
  reason: z.string().trim().max(500).optional(),
});
export type BanMemberInput = z.infer<typeof banMemberInput>;

export const createThreadInput = z.object({
  type: clubThreadType.optional(),
  title: z.string().min(1).max(240),
  bookId: z.string().min(1).optional(),
  chapter: z.string().max(120).optional(),
  hasSpoilers: z.boolean().optional(),
  expiresAt: z.number().int().optional(), // epoch ms, announcements
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

export const createMeetingInput = z.object({
  title: z.string().min(1).max(240),
  description: z.string().max(4000).optional(),
  bookId: z.string().min(1).optional(),
  meetingDate: z.number().int(), // epoch ms
  endDate: z.number().int().optional(),
  meetingType: meetingType.optional(),
  locationName: z.string().max(240).optional(),
  locationAddress: z.string().max(500).optional(),
  locationUrl: webUrl().optional(),
  isRecurring: z.boolean().optional(),
  recurrenceRule: z.string().max(500).optional(),
  rsvpLimit: z.number().int().positive().max(100000).optional(),
});
export type CreateMeetingInput = z.infer<typeof createMeetingInput>;

export const rsvpInput = z.object({
  status: rsvpStatus,
});
export type RsvpInput = z.infer<typeof rsvpInput>;

export const createScheduleInput = z.object({
  chapterName: z.string().min(1).max(240),
  unlockDate: z.number().int(), // epoch ms
});
export type CreateScheduleInput = z.infer<typeof createScheduleInput>;
