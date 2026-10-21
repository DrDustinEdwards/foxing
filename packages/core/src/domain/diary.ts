// Diary / reviews domain. diary_entries is THE rating + review home.
//
// EVENT RULE (approved): creating an entry emits 'reviewed' (it has review text) or
// 'rated' (rating only), RESPECTING visibility -- a private entry emits NO event; a
// friends/public entry emits a feed event carrying that visibility. We do NOT emit
// 'finished' here: Phase 3 library status already emits finished_book, so the diary
// path must never double-count a finish.
import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { emit, type EventActor } from "../events";
import * as diaryRepo from "../repositories/diary";
import { books } from "../schema";
import type { CreateDiaryInput, UpdateDiaryInput } from "../validators/social";
import { domainErrors } from "./errors";

async function bookTitle(db: Db, bookId: string): Promise<string | null> {
  const [row] = await db
    .select({ title: books.title })
    .from(books)
    .where(eq(books.id, bookId))
    .limit(1);
  return row ? row.title : null;
}

function hasText(s: string | null | undefined): s is string {
  return typeof s === "string" && s.trim().length > 0;
}

export async function createEntry(
  db: Db,
  actor: EventActor,
  input: CreateDiaryInput,
): Promise<diaryRepo.DiaryEntry> {
  const title = await bookTitle(db, input.bookId);
  if (title === null) throw domainErrors.notFound("Book not found.");

  const visibility = input.visibility ?? "private";
  const entry = await diaryRepo.createEntry(db, actor.userId, {
    bookId: input.bookId,
    logDate: input.logDate,
    ratingHalf: input.ratingHalf ?? null,
    review: input.review ?? null,
    containsSpoilers: input.containsSpoilers,
    visibility,
    bookTitle: title,
  });

  await diaryRepo.recomputeBookRating(db, input.bookId);

  // Feed emission respects the entry's own visibility. Private -> nothing.
  if (visibility !== "private") {
    const payload = {
      bookId: input.bookId,
      title,
      ratingHalf: entry.ratingHalf,
      visibility,
      diaryId: entry.id,
    };
    if (hasText(entry.review)) {
      await emit(db, "diary.reviewed", actor, payload);
    } else if (entry.ratingHalf != null) {
      await emit(db, "diary.rated", actor, payload);
    }
  }

  return entry;
}

async function requireOwnedEntry(
  db: Db,
  actor: EventActor,
  entryId: string,
): Promise<diaryRepo.DiaryEntry> {
  const entry = await diaryRepo.getEntryById(db, entryId);
  if (!entry) throw domainErrors.notFound("Diary entry not found.");
  if (entry.userId !== actor.userId) throw domainErrors.forbidden("This is not your entry.");
  return entry;
}

// Editing an existing entry does NOT re-emit a feed event (the "creating a diary entry
// emits" rule is create-only; re-emitting on edit would spam the feed). The rating
// aggregate is recomputed because the rating may have changed.
export async function updateEntry(
  db: Db,
  actor: EventActor,
  entryId: string,
  patch: UpdateDiaryInput,
): Promise<diaryRepo.DiaryEntry> {
  const entry = await requireOwnedEntry(db, actor, entryId);
  const updated = await diaryRepo.updateEntry(db, entryId, patch);
  if (!updated) throw domainErrors.notFound("Diary entry not found.");
  await diaryRepo.recomputeBookRating(db, entry.bookId);
  return updated;
}

export async function deleteEntry(db: Db, actor: EventActor, entryId: string): Promise<void> {
  const entry = await requireOwnedEntry(db, actor, entryId);
  await diaryRepo.deleteEntry(db, entryId);
  await diaryRepo.recomputeBookRating(db, entry.bookId);
}
