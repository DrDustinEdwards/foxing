// Validators for the library/tracking write paths: shelf status, custom shelves,
// and reading goals. Enums come from the single source in enums.ts.
import { z } from "zod";
import { goalPeriod, goalType, userBookStatus } from "../enums";

export const setStatusInput = z.object({
  status: userBookStatus,
});
export type SetStatusInput = z.infer<typeof setStatusInput>;

export const createShelfInput = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  isPublic: z.boolean().optional(),
});
export type CreateShelfInput = z.infer<typeof createShelfInput>;

export const shelfBookInput = z.object({
  bookId: z.string().min(1),
});
export type ShelfBookInput = z.infer<typeof shelfBookInput>;

export const createGoalInput = z
  .object({
    type: goalType,
    target: z.number().int().positive(),
    periodType: goalPeriod,
    year: z.number().int().min(2000).max(2100),
    month: z.number().int().min(1).max(12).optional(),
    week: z.number().int().min(1).max(53).optional(),
  })
  .refine((v) => v.periodType !== "month" || v.month !== undefined, {
    message: "month is required for a monthly goal",
    path: ["month"],
  })
  .refine((v) => v.periodType !== "week" || v.week !== undefined, {
    message: "week is required for a weekly goal",
    path: ["week"],
  });
export type CreateGoalInput = z.infer<typeof createGoalInput>;
