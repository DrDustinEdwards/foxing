// The Locator schema is deliberately permissive: it keeps the full Readium Locator (text.before/after and extras like cssSelector/fragments)
// verbatim so re-anchoring survives duplicate phrases; mobile ignores fields it does not use.
import { z } from "zod";
import { annotationType, highlightColor } from "../enums";

export const locatorText = z
  .object({
    before: z.string().optional(),
    highlight: z.string().optional(),
    after: z.string().optional(),
  })
  .passthrough();

export const locatorLocations = z
  .object({
    fragments: z.array(z.string()).optional(),
    progression: z.number().min(0).max(1).optional(),
    totalProgression: z.number().min(0).max(1).optional(),
    position: z.number().optional(),
  })
  .passthrough();

export const locator = z
  .object({
    href: z.string(),
    type: z.string(),
    title: z.string().optional(),
    locations: locatorLocations.optional(),
    text: locatorText.optional(),
  })
  .passthrough();
export type Locator = z.infer<typeof locator>;

export const createAnnotationInput = z
  .object({
    id: z.string().min(1).max(64).optional(), // client-generatable (offline-idempotent)
    bookId: z.string().min(1),
    type: annotationType,
    locator: locator.nullable().optional(),
    selectedText: z.string().max(20000).optional(),
    body: z.string().max(20000).optional(),
    color: highlightColor.optional(),
    chapter: z.string().max(500).optional(),
    // Optional: an unspecified audience is resolved from the reader's default in domain/annotations.createAnnotation. 'club' is an EXPOSURE
    // (the annotation stays personal, club_id NULL; clubs are derived at read time from the author's current-read clubs).
    visibility: z.enum(["private", "friends", "club", "public"]).optional(),
    containsSpoilers: z.boolean().optional(),
  })
  .refine((v) => v.type !== "highlight" || !!v.color, {
    message: "highlight requires a color",
    path: ["color"],
  });
export type CreateAnnotationInput = z.infer<typeof createAnnotationInput>;

/** Passage discussion: club- and book-scoped, anchored to a passage (locator) or a reply target (parentId). No visibility: the audience is its club; membership is enforced in the domain. */
export const createPassageCommentInput = z
  .object({
    id: z.string().min(1).max(64).optional(),
    clubId: z.string().min(1),
    bookId: z.string().min(1),
    body: z.string().min(1).max(20000),
    locator: locator.nullable().optional(),
    parentId: z.string().min(1).optional(),
    containsSpoilers: z.boolean().optional(),
  })
  .refine((v) => !!v.parentId || !!v.locator, {
    message: "a comment needs a passage locator or a parent to reply to",
    path: ["locator"],
  });
export type CreatePassageCommentInput = z.infer<typeof createPassageCommentInput>;

export const updateAnnotationInput = z.object({
  id: z.string().min(1),
  body: z.string().max(20000).nullable().optional(),
  color: highlightColor.optional(),
  visibility: z.enum(["private", "friends", "club", "public"]).optional(),
  isPinned: z.boolean().optional(),
  containsSpoilers: z.boolean().optional(),
});
export type UpdateAnnotationInput = z.infer<typeof updateAnnotationInput>;

export const saveProgressInput = z.object({
  bookId: z.string().min(1),
  locator: locator,
  progressPct: z.number().min(0).max(100),
});
export type SaveProgressInput = z.infer<typeof saveProgressInput>;
