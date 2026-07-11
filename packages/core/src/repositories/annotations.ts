// Annotations read/write data access. The reader (Phase 3, unmerged) writes highlights,
// notes, and bookmarks through the domain layer; these aggregate reads back the
// /highlights and /commonplace pages, and createAnnotation is the single insert the
// write path uses (so the default-visibility rule lives in one place: domain/annotations).
import { and, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "../db";
import { annotations, books } from "../schema";

export type Annotation = typeof annotations.$inferSelect;

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

/** A user's own annotations of the given types, newest first, with book context. */
export async function listForUser(
  db: Db,
  userId: string,
  opts: { types?: string[]; limit?: number } = {},
): Promise<AnnotationCard[]> {
  const conds = [eq(annotations.userId, userId)];
  if (opts.types && opts.types.length > 0) conds.push(inArray(annotations.type, opts.types));
  const rows = await db
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
    .leftJoin(books, eq(annotations.bookId, books.id))
    .where(and(...conds))
    .orderBy(desc(annotations.createdAt))
    .limit(Math.min(opts.limit ?? 200, 500));
  return rows;
}

export type NewAnnotation = {
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

export async function createAnnotation(db: Db, input: NewAnnotation): Promise<string> {
  const [row] = await db
    .insert(annotations)
    .values({
      userId: input.userId,
      type: input.type,
      bookId: input.bookId ?? null,
      clubId: input.clubId ?? null,
      locator: input.locator ?? null,
      selectedText: input.selectedText ?? null,
      normalizedText: input.normalizedText ?? null,
      body: input.body ?? null,
      color: input.color ?? null,
      chapter: input.chapter ?? null,
      sourceTitle: input.sourceTitle ?? null,
      visibility: input.visibility,
      containsSpoilers: input.containsSpoilers ?? false,
      parentId: input.parentId ?? null,
    })
    .returning({ id: annotations.id });
  return row.id;
}
