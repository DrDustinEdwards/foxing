// Reader hooks: one book's annotation layers, and every write the reader makes
// (highlights, notes, bookmarks, likes, passage replies, reading position). Writes
// carry a client-made id, so the new highlight is on the page before the server
// answers, and a failure takes it back off with the error shown.
import type * as W from "@foxing/types";
import { keys } from "./keys";
import { useApi } from "./provider";
import { patch, useSeededQuery, useWrite } from "./query";

/** An id the server accepts as the annotation's own (createAnnotationInput.id). */
export function newId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function useBookAnnotations<S extends W.ReaderAnnotations | undefined = undefined>(
  bookId: string,
  seed?: S,
) {
  const api = useApi();
  return useSeededQuery(
    {
      queryKey: keys.annotations(bookId),
      queryFn: () => api.get<W.ReaderAnnotations>(`/books/${bookId}/annotations`),
    },
    seed,
  );
}

function patchLayers(bookId: string, update: (l: W.ReaderAnnotations) => W.ReaderAnnotations) {
  return patch<W.ReaderAnnotations>(keys.annotations(bookId), update);
}

export interface NewAnnotation {
  id: string;
  bookId: string;
  type: "highlight" | "note" | "bookmark" | "commonplace";
  locator: W.Locator | null;
  selectedText?: string;
  body?: string;
  color?: string;
  chapter?: string;
  /** "club" shares it with the reader's clubs; omitted takes their default audience. */
  visibility?: "private" | "friends" | "club" | "public";
}

export function useCreateAnnotation() {
  const api = useApi();
  return useWrite<NewAnnotation>({
    write: (input) => api.post("/annotations", { ...input }),
    optimistic: (a) => [
      patchLayers(a.bookId, (l) => ({
        ...l,
        mine: [
          ...l.mine.filter((m) => m.id !== a.id),
          {
            id: a.id,
            type: a.type,
            locator: a.locator,
            selectedText: a.selectedText ?? null,
            body: a.body ?? null,
            color: a.color ?? null,
            chapter: a.chapter ?? null,
          },
        ],
      })),
    ],
    invalidates: ({ bookId }) => [keys.annotations(bookId), keys.allMyAnnotations, keys.streak],
  });
}

export function useUpdateAnnotation() {
  const api = useApi();
  return useWrite<{ bookId: string; id: string; color?: string; body?: string | null }>({
    write: ({ id, bookId: _bookId, ...fields }) => api.patch(`/annotations/${id}`, fields),
    optimistic: ({ bookId, id, ...fields }) => [
      patchLayers(bookId, (l) => ({
        ...l,
        mine: l.mine.map((m) => (m.id === id ? { ...m, ...fields } : m)),
      })),
    ],
    invalidates: ({ bookId }) => [keys.annotations(bookId), keys.allMyAnnotations],
  });
}

export function useDeleteAnnotation() {
  const api = useApi();
  return useWrite<{ bookId: string; id: string }>({
    write: ({ id }) => api.delete(`/annotations/${id}`),
    optimistic: ({ bookId, id }) => [
      patchLayers(bookId, (l) => ({ ...l, mine: l.mine.filter((m) => m.id !== id) })),
    ],
    invalidates: ({ bookId }) => [keys.annotations(bookId), keys.allMyAnnotations],
  });
}

/** Like or unlike another reader's annotation. */
export function useLikeAnnotation() {
  const api = useApi();
  return useWrite<{ bookId: string; id: string; on: boolean }>({
    write: ({ id, on }) => {
      const body = { targetType: "annotation", targetId: id, kind: "like" };
      return on ? api.put("/reactions", body) : api.delete("/reactions", body);
    },
    optimistic: ({ bookId, id, on }) => [
      patchLayers(bookId, (l) => ({
        ...l,
        others: l.others.map((o) =>
          o.id === id && o.likedByMe !== on
            ? { ...o, likedByMe: on, likeCount: Math.max(0, o.likeCount + (on ? 1 : -1)) }
            : o,
        ),
      })),
    ],
    invalidates: ({ bookId }) => [keys.annotations(bookId)],
  });
}

/** A reply to another reader's annotation, or a comment on a passage, in a club both
 *  belong to. `you` is how the new comment shows until the server's copy arrives. */
export function usePassageComment() {
  const api = useApi();
  return useWrite<{
    id: string;
    clubId: string;
    bookId: string;
    body: string;
    parentId?: string;
    locator?: W.Locator | null;
    chapter?: string | null;
    you: W.AnnotationAuthor;
  }>({
    write: ({ chapter: _chapter, you: _you, ...input }) => api.post("/annotations/comments", input),
    optimistic: (c) => [
      patchLayers(c.bookId, (l) => ({
        ...l,
        comments: [
          ...l.comments,
          {
            id: c.id,
            clubId: c.clubId,
            parentId: c.parentId ?? null,
            locator: c.locator ?? null,
            body: c.body,
            chapter: c.chapter ?? null,
            isPinned: false,
            containsSpoilers: false,
            gate: { spoiler: false, ahead: false },
            author: c.you,
            createdAt: Date.now(),
          },
        ],
        others: l.others.map((o) =>
          o.id === c.parentId ? { ...o, replyCount: o.replyCount + 1 } : o,
        ),
      })),
    ],
    invalidates: ({ bookId }) => [keys.annotations(bookId)],
  });
}

/** Saves the reading position. Called on every settled page turn, so it patches the
 *  cached progress instead of refetching anything. */
export function useSaveProgress() {
  const api = useApi();
  return useWrite<{ bookId: string; locator: W.Locator; progressPct: number }>({
    write: ({ bookId, ...input }) => api.put(`/books/${bookId}/progress`, input),
    optimistic: ({ bookId, locator, progressPct }) => [
      patch<W.MyBookState>(keys.myBook(bookId), (s) => ({
        ...s,
        status: s.status ?? "reading",
        progress: locator,
        progressPct,
      })),
      patch<W.LibraryEntry[]>(keys.library, (list) =>
        list.map((e) => (e.bookId === bookId ? { ...e, progressPct } : e)),
      ),
      patchLayers(bookId, (l) => ({ ...l, viewerProgressPct: progressPct })),
    ],
  });
}
