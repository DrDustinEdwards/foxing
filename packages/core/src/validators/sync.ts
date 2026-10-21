// Offline sync contract. The mobile client queues single-owner writes locally
// and flushes them to POST /api/v1/sync; GET /api/v1/sync?since= pulls changed rows back.
// Single-owner resources ONLY (annotations, user_books/progress, sessions, vocabulary,
// diary). Clubs/social are online-only v1. Payloads are validated per resource; the
// server always scopes to the session user and never trusts payload.user_id.
import { z } from "zod";
import { annotationType, annotationVisibility, diaryVisibility, userBookStatus } from "../enums";

export const syncResourceValues = [
  "annotation",
  "user_book",
  "session",
  "vocabulary",
  "diary",
] as const;
export const syncResource = z.enum(syncResourceValues);
export type SyncResource = z.infer<typeof syncResource>;

export const syncVerbValues = ["create", "update", "delete"] as const;
export const syncVerb = z.enum(syncVerbValues);
export type SyncVerb = z.infer<typeof syncVerb>;

// A Readium Locator envelope. During the paused Readium reader migration the mobile
// reader carries its epubjs CFI inside locator.locations.fragment; real Locators land
// with the Readium reader. The contract is Locator-shaped from day one so no
// uninterpretable position data is ever written.
const locator = z.record(z.unknown());

// -- Per-resource payloads (writable columns only). Timestamps are epoch ms. ----

const annotationPayload = z.object({
  bookId: z.string().min(1).nullable().optional(),
  clubId: z.string().min(1).nullable().optional(),
  type: annotationType.optional(),
  locator: locator.nullable().optional(),
  selectedText: z.string().nullable().optional(),
  normalizedText: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  color: z.string().max(20).nullable().optional(),
  chapter: z.string().nullable().optional(),
  sourceTitle: z.string().nullable().optional(),
  visibility: annotationVisibility.optional(),
  containsSpoilers: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  parentId: z.string().min(1).nullable().optional(),
});

const userBookPayload = z.object({
  bookId: z.string().min(1),
  status: userBookStatus.optional(),
  progress: locator.nullable().optional(), // Readium Locator
  progressPct: z.number().min(0).max(100).optional(),
  startedAt: z.number().int().nullable().optional(),
  finishedAt: z.number().int().nullable().optional(),
  pausedAt: z.number().int().nullable().optional(),
  pausedNote: z.string().nullable().optional(),
  abandonedAt: z.number().int().nullable().optional(),
  moodTags: z.array(z.string()).nullable().optional(),
  personalNotes: z.string().nullable().optional(),
});

const sessionPayload = z.object({
  bookId: z.string().min(1),
  startedAt: z.number().int(),
  endedAt: z.number().int().nullable().optional(),
  pagesRead: z.number().int().min(0).optional(),
  avgWpm: z.number().nullable().optional(),
  lastWpm: z.number().nullable().optional(),
});

const vocabularyPayload = z.object({
  bookId: z.string().min(1).nullable().optional(),
  word: z.string().min(1),
  definition: z.string().min(1),
  contextSentence: z.string().nullable().optional(),
  aiContext: z.string().nullable().optional(),
  mastered: z.boolean().optional(),
  lookedUpAt: z.number().int().optional(),
});

const diaryPayload = z.object({
  bookId: z.string().min(1),
  logDate: z.number().int().optional(),
  ratingHalf: z.number().int().min(1).max(10).nullable().optional(),
  review: z.string().nullable().optional(),
  containsSpoilers: z.boolean().optional(),
  visibility: diaryVisibility.optional(),
});

// One queued op. id is a client-generated nanoid: for id-keyed resources it IS the row
// PK (so a replayed create is idempotent). user_book is keyed by (user, bookId) instead;
// its id is carried only to correlate the per-op result.
export const syncOp = z.object({
  id: z.string().min(1).max(64),
  resource: syncResource,
  verb: syncVerb,
  payload: z.record(z.unknown()).optional(),
  clientTs: z.number().int(),
});
export type SyncOp = z.infer<typeof syncOp>;

export const syncPushInput = z.object({
  ops: z.array(syncOp).max(500),
});
export type SyncPushInput = z.infer<typeof syncPushInput>;

// Payload validators keyed by resource, used by the domain to parse op.payload.
export const syncPayloadSchemas = {
  annotation: annotationPayload,
  user_book: userBookPayload,
  session: sessionPayload,
  vocabulary: vocabularyPayload,
  diary: diaryPayload,
} as const;
