// Offline sync contract. The mobile client queues single-owner writes locally
// and flushes them to POST /api/v1/sync; GET /api/v1/sync?since= pulls changed rows back.
// Single-owner resources ONLY (annotations, user_books/progress, sessions, vocabulary,
// diary). Clubs/social are online-only v1. Payloads are validated per resource; the
// server always scopes to the session user and never trusts payload.user_id.
import { z } from "zod";
import { annotationVisibility, diaryVisibility, highlightColor, userBookStatus } from "../enums";

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
const locator = z.record(z.string(), z.unknown());
const text = z.string().max(20000);

// Personal annotations only: no clubId, parentId or comment type (those need the club
// membership checks of domain/annotations), and normalizedText is computed on the server.
const annotationPayload = z.object({
  bookId: z.string().min(1).nullable().optional(),
  type: z.enum(["highlight", "note", "bookmark", "commonplace"]).optional(),
  locator: locator.nullable().optional(),
  selectedText: text.nullable().optional(),
  body: text.nullable().optional(),
  color: highlightColor.nullable().optional(),
  chapter: z.string().max(500).nullable().optional(),
  sourceTitle: z.string().max(500).nullable().optional(),
  visibility: annotationVisibility.optional(),
  containsSpoilers: z.boolean().optional(),
  isPinned: z.boolean().optional(),
});

const userBookPayload = z.object({
  bookId: z.string().min(1),
  status: userBookStatus.optional(),
  progress: locator.nullable().optional(), // Readium Locator
  progressPct: z.number().min(0).max(100).optional(),
  startedAt: z.number().int().nullable().optional(),
  finishedAt: z.number().int().nullable().optional(),
  pausedAt: z.number().int().nullable().optional(),
  pausedNote: text.nullable().optional(),
  abandonedAt: z.number().int().nullable().optional(),
  moodTags: z.array(z.string().max(50)).max(20).nullable().optional(),
  personalNotes: text.nullable().optional(),
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
  word: z.string().min(1).max(200),
  definition: text.min(1),
  contextSentence: text.nullable().optional(),
  aiContext: text.nullable().optional(),
  mastered: z.boolean().optional(),
  lookedUpAt: z.number().int().optional(),
});

const diaryPayload = z.object({
  bookId: z.string().min(1),
  logDate: z.number().int().optional(),
  ratingHalf: z.number().int().min(1).max(10).nullable().optional(),
  review: text.nullable().optional(),
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
  payload: z.record(z.string(), z.unknown()).optional(),
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
