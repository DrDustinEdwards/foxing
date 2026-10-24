// Validator for POST /api/v1/companion. The `action` enum is the 15 D11 on-demand
// actions ONLY -- the 4 free-cached generators are never accepted here (Queue-only).
import { z } from "zod";
import { PLUS_ACTION_NAMES } from "../companion/registry";

export const companionSelection = z.object({
  text: z.string().min(1).max(4000),
  locator: z.unknown().optional(),
  chapter: z.string().max(200).nullish(),
});

export const companionInput = z.object({
  action: z.enum(PLUS_ACTION_NAMES as [string, ...string[]]),
  bookId: z.string().min(1),
  threadId: z.string().min(1).optional(),
  message: z.string().max(4000).optional(),
  selection: companionSelection.optional(),
  /** Where the reader is, for chapter-scoped actions sent without a selection. */
  chapter: z.string().max(200).optional(),
  targetLanguage: z.string().max(40).optional(),
});
export type CompanionInput = z.infer<typeof companionInput>;
