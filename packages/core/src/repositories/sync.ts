// Sync executors (Phase 7). One adapter per single-owner resource: existence/LWW probe,
// insert, update, delete, and the pull query. The pure conflict decision lives in
// domain/sync.ts (resolveSyncOp); this file only executes a decision against D1. Every
// operation is scoped to the session user id -- payload.user_id is never trusted.
import { and, eq, gt, sql } from "drizzle-orm";
import type { Db } from "../db";
import { normalizeText } from "../domain/text";
import { annotations, diaryEntries, readingSessions, userBooks, vocabulary } from "../schema";
import type { SyncOp } from "../validators/sync";

const toDate = (n: number | null | undefined): Date | null => (n == null ? null : new Date(n));

/** Minimal existence + freshness probe for the LWW decision. updatedAt is epoch ms. */
export type Existing = { updatedAt: number } | null;

export type SyncAdapter = {
  appendOnly?: boolean;
  probe(db: Db, userId: string, op: SyncOp): Promise<Existing>;
  insert(db: Db, userId: string, op: SyncOp): Promise<void>;
  update(db: Db, userId: string, op: SyncOp): Promise<void>;
  remove(db: Db, userId: string, op: SyncOp): Promise<void>;
  listChanged(db: Db, userId: string, sinceMs: number): Promise<unknown[]>;
};

// -- annotations ------------------------------------------------------------

const annotationAdapter: SyncAdapter = {
  async probe(db, userId, op) {
    const [row] = await db
      .select({ updatedAt: annotations.updatedAt })
      .from(annotations)
      .where(and(eq(annotations.id, op.id), eq(annotations.userId, userId)))
      .limit(1);
    return row ? { updatedAt: row.updatedAt?.getTime() ?? 0 } : null;
  },
  async insert(db, userId, op) {
    const p = (op.payload ?? {}) as Record<string, unknown>;
    const selectedText = (p.selectedText as string | null) ?? null;
    const normalized =
      (p.normalizedText as string | null) ?? (selectedText ? normalizeText(selectedText) : null);
    await db.insert(annotations).values({
      id: op.id,
      userId,
      bookId: (p.bookId as string | null) ?? null,
      clubId: (p.clubId as string | null) ?? null,
      type: (p.type as string) ?? "highlight",
      locator: (p.locator as Record<string, unknown> | null) ?? null,
      selectedText,
      normalizedText: normalized,
      body: (p.body as string | null) ?? null,
      color: (p.color as string | null) ?? null,
      chapter: (p.chapter as string | null) ?? null,
      sourceTitle: (p.sourceTitle as string | null) ?? null,
      visibility: (p.visibility as string) ?? "private",
      containsSpoilers: (p.containsSpoilers as boolean) ?? false,
      isPinned: (p.isPinned as boolean) ?? false,
      parentId: (p.parentId as string | null) ?? null,
      updatedAt: new Date(op.clientTs),
    });
  },
  async update(db, userId, op) {
    const p = (op.payload ?? {}) as Record<string, unknown>;
    const set: Record<string, unknown> = { updatedAt: new Date(op.clientTs) };
    for (const k of [
      "bookId",
      "type",
      "locator",
      "selectedText",
      "body",
      "color",
      "chapter",
      "visibility",
      "containsSpoilers",
      "isPinned",
    ]) {
      if (k in p) set[k] = p[k];
    }
    if ("selectedText" in p && !("normalizedText" in p)) {
      set.normalizedText = p.selectedText ? normalizeText(p.selectedText as string) : null;
    }
    await db
      .update(annotations)
      .set(set)
      .where(and(eq(annotations.id, op.id), eq(annotations.userId, userId)));
  },
  async remove(db, userId, op) {
    await db
      .delete(annotations)
      .where(and(eq(annotations.id, op.id), eq(annotations.userId, userId)));
  },
  async listChanged(db, userId, sinceMs) {
    return db
      .select()
      .from(annotations)
      .where(and(eq(annotations.userId, userId), gt(annotations.updatedAt, new Date(sinceMs))));
  },
};

// -- user_books (keyed by (user, book); upsert) -----------------------------

function userBookValues(p: Record<string, unknown>, clientTs: number) {
  const v: Record<string, unknown> = { updatedAt: new Date(clientTs) };
  if ("status" in p) v.status = p.status;
  if ("progress" in p) v.progress = p.progress;
  if ("progressPct" in p) v.progressPct = p.progressPct;
  if ("startedAt" in p) v.startedAt = toDate(p.startedAt as number | null);
  if ("finishedAt" in p) v.finishedAt = toDate(p.finishedAt as number | null);
  if ("pausedAt" in p) v.pausedAt = toDate(p.pausedAt as number | null);
  if ("pausedNote" in p) v.pausedNote = p.pausedNote;
  if ("abandonedAt" in p) v.abandonedAt = toDate(p.abandonedAt as number | null);
  if ("moodTags" in p) v.moodTags = p.moodTags;
  if ("personalNotes" in p) v.personalNotes = p.personalNotes;
  return v;
}

const userBookAdapter: SyncAdapter = {
  async probe(db, userId, op) {
    const bookId = (op.payload as { bookId?: string })?.bookId;
    if (!bookId) return null;
    const [row] = await db
      .select({ updatedAt: userBooks.updatedAt })
      .from(userBooks)
      .where(and(eq(userBooks.userId, userId), eq(userBooks.bookId, bookId)))
      .limit(1);
    return row ? { updatedAt: row.updatedAt?.getTime() ?? 0 } : null;
  },
  // create and update are the same upsert on (user, book): the resolver has already
  // decided whether to apply (greatest client_ts wins).
  async insert(db, userId, op) {
    await this.update(db, userId, op);
  },
  async update(db, userId, op) {
    const p = (op.payload ?? {}) as Record<string, unknown>;
    const bookId = p.bookId as string;
    const values = userBookValues(p, op.clientTs);
    await db
      .insert(userBooks)
      .values({
        id: op.id,
        userId,
        bookId,
        status: (p.status as string) ?? "want",
        ...values,
      })
      .onConflictDoUpdate({ target: [userBooks.userId, userBooks.bookId], set: values });
  },
  async remove(db, userId, op) {
    const bookId = (op.payload as { bookId?: string })?.bookId;
    if (!bookId) return;
    await db
      .delete(userBooks)
      .where(and(eq(userBooks.userId, userId), eq(userBooks.bookId, bookId)));
  },
  async listChanged(db, userId, sinceMs) {
    return db
      .select()
      .from(userBooks)
      .where(and(eq(userBooks.userId, userId), gt(userBooks.updatedAt, new Date(sinceMs))));
  },
};

// -- reading_sessions (append-only) -----------------------------------------

const sessionAdapter: SyncAdapter = {
  appendOnly: true,
  async probe(db, userId, op) {
    const [row] = await db
      .select({ createdAt: readingSessions.createdAt })
      .from(readingSessions)
      .where(and(eq(readingSessions.id, op.id), eq(readingSessions.userId, userId)))
      .limit(1);
    return row ? { updatedAt: row.createdAt?.getTime() ?? 0 } : null;
  },
  async insert(db, userId, op) {
    const p = (op.payload ?? {}) as Record<string, unknown>;
    await db.insert(readingSessions).values({
      id: op.id,
      userId,
      bookId: p.bookId as string,
      startedAt: new Date(p.startedAt as number),
      endedAt: toDate(p.endedAt as number | null),
      pagesRead: (p.pagesRead as number) ?? 0,
      avgWpm: (p.avgWpm as number | null) ?? null,
      lastWpm: (p.lastWpm as number | null) ?? null,
    });
  },
  async update() {
    /* append-only: never reached (resolver returns noop) */
  },
  async remove() {
    /* append-only */
  },
  async listChanged(db, userId, sinceMs) {
    return db
      .select()
      .from(readingSessions)
      .where(
        and(eq(readingSessions.userId, userId), gt(readingSessions.createdAt, new Date(sinceMs))),
      );
  },
};

// -- vocabulary (updated_at nullable -> coalesce created_at) ----------------

const VOCAB_TS = sql<number>`coalesce(${vocabulary.updatedAt}, ${vocabulary.createdAt})`;

const vocabularyAdapter: SyncAdapter = {
  async probe(db, userId, op) {
    const [row] = await db
      .select({ ts: VOCAB_TS })
      .from(vocabulary)
      .where(and(eq(vocabulary.id, op.id), eq(vocabulary.userId, userId)))
      .limit(1);
    return row ? { updatedAt: Number(row.ts) } : null;
  },
  async insert(db, userId, op) {
    const p = (op.payload ?? {}) as Record<string, unknown>;
    await db.insert(vocabulary).values({
      id: op.id,
      userId,
      bookId: (p.bookId as string | null) ?? null,
      word: p.word as string,
      definition: p.definition as string,
      contextSentence: (p.contextSentence as string | null) ?? null,
      aiContext: (p.aiContext as string | null) ?? null,
      mastered: (p.mastered as boolean) ?? false,
      lookedUpAt: p.lookedUpAt ? new Date(p.lookedUpAt as number) : new Date(op.clientTs),
      updatedAt: new Date(op.clientTs),
    });
  },
  async update(db, userId, op) {
    const p = (op.payload ?? {}) as Record<string, unknown>;
    const set: Record<string, unknown> = { updatedAt: new Date(op.clientTs) };
    for (const k of ["bookId", "word", "definition", "contextSentence", "aiContext", "mastered"]) {
      if (k in p) set[k] = p[k];
    }
    await db
      .update(vocabulary)
      .set(set)
      .where(and(eq(vocabulary.id, op.id), eq(vocabulary.userId, userId)));
  },
  async remove(db, userId, op) {
    await db.delete(vocabulary).where(and(eq(vocabulary.id, op.id), eq(vocabulary.userId, userId)));
  },
  async listChanged(db, userId, sinceMs) {
    return db
      .select()
      .from(vocabulary)
      .where(and(eq(vocabulary.userId, userId), gt(VOCAB_TS, sinceMs)));
  },
};

// -- diary_entries ----------------------------------------------------------

const diaryAdapter: SyncAdapter = {
  async probe(db, userId, op) {
    const [row] = await db
      .select({ updatedAt: diaryEntries.updatedAt })
      .from(diaryEntries)
      .where(and(eq(diaryEntries.id, op.id), eq(diaryEntries.userId, userId)))
      .limit(1);
    return row ? { updatedAt: row.updatedAt?.getTime() ?? 0 } : null;
  },
  async insert(db, userId, op) {
    const p = (op.payload ?? {}) as Record<string, unknown>;
    await db.insert(diaryEntries).values({
      id: op.id,
      userId,
      bookId: p.bookId as string,
      logDate: p.logDate ? new Date(p.logDate as number) : new Date(op.clientTs),
      ratingHalf: (p.ratingHalf as number | null) ?? null,
      review: (p.review as string | null) ?? null,
      containsSpoilers: (p.containsSpoilers as boolean) ?? false,
      visibility: (p.visibility as string) ?? "private",
      updatedAt: new Date(op.clientTs),
    });
  },
  async update(db, userId, op) {
    const p = (op.payload ?? {}) as Record<string, unknown>;
    const set: Record<string, unknown> = { updatedAt: new Date(op.clientTs) };
    if ("logDate" in p) set.logDate = toDate(p.logDate as number | null);
    for (const k of ["ratingHalf", "review", "containsSpoilers", "visibility"]) {
      if (k in p) set[k] = p[k];
    }
    await db
      .update(diaryEntries)
      .set(set)
      .where(and(eq(diaryEntries.id, op.id), eq(diaryEntries.userId, userId)));
  },
  async remove(db, userId, op) {
    await db
      .delete(diaryEntries)
      .where(and(eq(diaryEntries.id, op.id), eq(diaryEntries.userId, userId)));
  },
  async listChanged(db, userId, sinceMs) {
    return db
      .select()
      .from(diaryEntries)
      .where(and(eq(diaryEntries.userId, userId), gt(diaryEntries.updatedAt, new Date(sinceMs))));
  },
};

export const syncAdapters = {
  annotation: annotationAdapter,
  user_book: userBookAdapter,
  session: sessionAdapter,
  vocabulary: vocabularyAdapter,
  diary: diaryAdapter,
} as const;
