// Validators for the reader write paths: annotations (highlight/note/bookmark)
// and reading progress. The Locator schema is intentionally permissive: it keeps
// the full serialized Readium Locator, including text.before/after (R1) and any
// locations extras like cssSelector/fragments the navigator provides, so
// re-anchoring survives duplicate phrases. Extras are stored verbatim; the other
// client (mobile) ignores fields it does not use (verified harmless).
import { z } from "zod";
import { annotationType, highlightColor } from "../enums";

/** RWPM Locator.text: { before?, highlight?, after? }. */
export const locatorText = z
  .object({
    before: z.string().optional(),
    highlight: z.string().optional(),
    after: z.string().optional(),
  })
  .passthrough();

/** RWPM Locator.locations: progression/position/totalProgression + fragments +
 *  any extension keys (e.g. cssSelector) flattened per the RWPM spec. */
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
    // Optional (no default) so an unspecified audience is resolved from the
    // reader's default-annotation preference in domain/annotations.createAnnotation.
    // Personal reader annotations are never club-scoped.
    visibility: z.enum(["private", "friends", "public"]).optional(),
    containsSpoilers: z.boolean().optional(),
  })
  .refine((v) => v.type !== "highlight" || !!v.color, {
    message: "highlight requires a color",
    path: ["color"],
  });
export type CreateAnnotationInput = z.infer<typeof createAnnotationInput>;

export const updateAnnotationInput = z.object({
  id: z.string().min(1),
  body: z.string().max(20000).nullable().optional(),
  color: highlightColor.optional(),
  visibility: z.enum(["private", "friends", "public"]).optional(),
  isPinned: z.boolean().optional(),
  containsSpoilers: z.boolean().optional(),
});
export type UpdateAnnotationInput = z.infer<typeof updateAnnotationInput>;

/** progressPct is a whole-book percentage (0..100), derived from the Locator's
 *  totalProgression. Stored alongside the Locator on user_books. */
export const saveProgressInput = z.object({
  bookId: z.string().min(1),
  locator: locator,
  progressPct: z.number().min(0).max(100),
});
export type SaveProgressInput = z.infer<typeof saveProgressInput>;
