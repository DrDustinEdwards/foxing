// createAnnotation is the single insert the write path uses, so the default-visibility rule lives in one place (domain/annotations).
// Reader helpers are user-scoped so a tenancy layer can wrap them.
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { domainErrors } from "../domain/errors";
import type { Db } from "../db";
import { normalizeText } from "../domain/text";
import { annotations, books } from "../schema";
import type { UpdateAnnotationInput } from "../validators/annotation";

export type Annotation = typeof annotations.$inferSelect;

const READER_TYPES = ["highlight", "note", "bookmark"] as const;

/** Count of a user's highlights; `publicOnly` never reveals private ones. */
export async function countHighlights(db: Db, userId: string, publicOnly = false): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(annotations)
    .where(
      and(
        eq(annotations.userId, userId),
        eq(annotations.type, "highlight"),
        publicOnly ? eq(annotations.visibility, "public") : undefined,
      ),
    );
  return Number(row?.n ?? 0);
}

export type AnnotationCard = {
  id: string;
  type: string;
  selectedText: string | null;
  body: string | null;
  color: string | null;
  chapter: string | null;
  sourceTitle: string | null;
  visibility: string;
  createdAt: Date;
  bookId: string | null;
  bookTitle: string | null;
  bookSlug: string | null;
  bookAuthor: string | null;
};

/** Annotations with their book's title, slug and author: the AnnotationCard columns. */
function selectCards(db: Db) {
  return db
    .select({
      id: annotations.id,
      type: annotations.type,
      selectedText: annotations.selectedText,
      body: annotations.body,
      color: annotations.color,
      chapter: annotations.chapter,
      sourceTitle: annotations.sourceTitle,
      visibility: annotations.visibility,
      createdAt: annotations.createdAt,
      bookId: annotations.bookId,
      bookTitle: books.title,
      bookSlug: books.slug,
      bookAuthor: books.author,
    })
    .from(annotations)
    .leftJoin(books, eq(annotations.bookId, books.id));
}

export async function listForUser(
  db: Db,
  userId: string,
  opts: { types?: string[]; limit?: number } = {},
): Promise<AnnotationCard[]> {
  const conds = [eq(annotations.userId, userId)];
  if (opts.types && opts.types.length > 0) conds.push(inArray(annotations.type, opts.types));
  return selectCards(db)
    .where(and(...conds))
    .orderBy(desc(annotations.createdAt))
    .limit(Math.min(opts.limit ?? 200, 500));
}

export async function listPublicHighlights(
  db: Db,
  userId: string,
  limit = 6,
): Promise<AnnotationCard[]> {
  return selectCards(db)
    .where(
      and(
        eq(annotations.userId, userId),
        eq(annotations.type, "highlight"),
        eq(annotations.visibility, "public"),
      ),
    )
    .orderBy(desc(annotations.createdAt))
    .limit(limit);
}

export type NewAnnotation = {
  // Client-generatable, so the reader and offline sync insert idempotently.
  id?: string | null;
  userId: string;
  type: string;
  bookId?: string | null;
  clubId?: string | null;
  locator?: Record<string, unknown> | null;
  selectedText?: string | null;
  normalizedText?: string | null;
  body?: string | null;
  color?: string | null;
  chapter?: string | null;
  sourceTitle?: string | null;
  visibility: string;
  containsSpoilers?: boolean;
  parentId?: string | null;
};

/** The single annotation insert. normalized_text (the popular-highlights key) is derived from the selected text or locator when not supplied. */
export async function createAnnotation(db: Db, input: NewAnnotation): Promise<Annotation> {
  const anchorText =
    input.selectedText ??
    (input.locator as { text?: { highlight?: string } } | null | undefined)?.text?.highlight ??
    null;
  const insert = db.insert(annotations).values({
    ...(input.id ? { id: input.id } : {}),
    userId: input.userId,
    type: input.type,
    bookId: input.bookId ?? null,
    clubId: input.clubId ?? null,
    locator: input.locator ?? null,
    selectedText: input.selectedText ?? null,
    normalizedText: input.normalizedText ?? (anchorText ? normalizeText(anchorText) : null),
    body: input.body ?? null,
    color: input.color ?? null,
    chapter: input.chapter ?? null,
    sourceTitle: input.sourceTitle ?? null,
    visibility: input.visibility,
    containsSpoilers: input.containsSpoilers ?? false,
    parentId: input.parentId ?? null,
  });
  if (!input.id) return (await insert.returning())[0];
  // A client-supplied id makes the create idempotent: a replay returns the row already stored, an id that is
  // another reader's row is a conflict.
  await insert.onConflictDoNothing();
  const [row] = await db
    .select()
    .from(annotations)
    .where(and(eq(annotations.id, input.id), eq(annotations.userId, input.userId)));
  if (!row) throw domainErrors.conflict("That id is already in use.");
  return row;
}

export async function listForReader(db: Db, userId: string, bookId: string): Promise<Annotation[]> {
  return db
    .select()
    .from(annotations)
    .where(
      and(
        eq(annotations.userId, userId),
        eq(annotations.bookId, bookId),
        inArray(annotations.type, READER_TYPES as unknown as string[]),
      ),
    )
    .orderBy(asc(annotations.createdAt));
}

export async function updateAnnotation(
  db: Db,
  userId: string,
  input: UpdateAnnotationInput,
): Promise<Annotation | null> {
  const patch: Partial<Annotation> = { updatedAt: new Date() };
  if (input.body !== undefined) patch.body = input.body;
  if (input.color !== undefined) patch.color = input.color;
  if (input.visibility !== undefined) patch.visibility = input.visibility;
  if (input.isPinned !== undefined) patch.isPinned = input.isPinned;
  if (input.containsSpoilers !== undefined) patch.containsSpoilers = input.containsSpoilers;

  const [row] = await db
    .update(annotations)
    .set(patch)
    .where(and(eq(annotations.id, input.id), eq(annotations.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteAnnotation(db: Db, userId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(annotations)
    .where(and(eq(annotations.id, id), eq(annotations.userId, userId)))
    .returning({ id: annotations.id });
  return rows.length > 0;
}
