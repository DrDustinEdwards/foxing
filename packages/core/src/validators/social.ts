// Validators for the Phase 6 social write paths: diary/reviews, reading lists,
// reactions. Follows/close-friends take no body (the target user is a path param).
// Enums come from the single source in enums.ts; core domain trusts the parsed shape.
import { z } from "zod";
import { diaryVisibility, reactionTarget } from "../enums";

// -- Diary / reviews --------------------------------------------------------
// diary_entries is THE review + rating home. rating_half is 1-10 halves (0.5-5 stars);
// omit for a review-only entry. Re-reads are allowed, so there is no per-book uniqueness.

export const createDiaryInput = z.object({
  bookId: z.string().min(1),
  logDate: z.number().int().optional(), // epoch ms; defaults to now in the domain
  ratingHalf: z.number().int().min(1).max(10).nullable().optional(),
  review: z.string().max(20000).nullable().optional(),
  containsSpoilers: z.boolean().optional(),
  visibility: diaryVisibility.optional(), // defaults to private
});
export type CreateDiaryInput = z.infer<typeof createDiaryInput>;

export const updateDiaryInput = z
  .object({
    logDate: z.number().int().optional(),
    ratingHalf: z.number().int().min(1).max(10).nullable().optional(),
    review: z.string().max(20000).nullable().optional(),
    containsSpoilers: z.boolean().optional(),
    visibility: diaryVisibility.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "no fields to update" });
export type UpdateDiaryInput = z.infer<typeof updateDiaryInput>;

// -- Reading lists ----------------------------------------------------------

export const createListInput = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(4000).nullable().optional(),
  coverUrl: z.string().url().max(2000).nullable().optional(),
  isPublic: z.boolean().optional(),
});
export type CreateListInput = z.infer<typeof createListInput>;

export const updateListInput = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(4000).nullable().optional(),
    coverUrl: z.string().url().max(2000).nullable().optional(),
    isPublic: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "no fields to update" });
export type UpdateListInput = z.infer<typeof updateListInput>;

export const addListBookInput = z.object({
  bookId: z.string().min(1),
  position: z.number().int().min(0).max(100000).optional(),
  note: z.string().max(2000).nullable().optional(),
});
export type AddListBookInput = z.infer<typeof addListBookInput>;

// -- Reactions --------------------------------------------------------------
// Generic like/reaction. Phase 6 wires reading_list + diary_entry targets; the enum
// carries the full set for later phases. kind is 'like' by default (no emoji in UI).

export const reactionInput = z.object({
  targetType: reactionTarget,
  targetId: z.string().min(1),
  kind: z.string().min(1).max(40).optional(), // defaults to 'like'
});
export type ReactionInput = z.infer<typeof reactionInput>;
