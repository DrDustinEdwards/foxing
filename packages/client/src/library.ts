// Library hooks: shelf status, custom shelves, goals, streak, vocabulary and
// notifications. Reads take an optional seed (the web loader's data); writes patch
// the cache first and refetch only what they touched.
import type * as W from "@foxing/types";
import { keys } from "./keys";
import { useApi } from "./provider";
import { patch, useSeededQuery, useWrite } from "./query";

// --- Shelf status -----------------------------------------------------------

export function useLibrary<S extends W.LibraryEntry[] | undefined = undefined>(seed?: S) {
  const api = useApi();
  return useSeededQuery(
    {
      queryKey: keys.library,
      queryFn: () => api.get<{ library: W.LibraryEntry[] }>("/library").then((r) => r.library),
    },
    seed,
  );
}

export function useMyBook<S extends W.MyBookState | undefined = undefined>(
  bookId: string,
  seed?: S,
  enabled = true,
) {
  const api = useApi();
  return useSeededQuery(
    {
      queryKey: keys.myBook(bookId),
      queryFn: () => api.get<W.MyBookState>(`/library/${bookId}`),
      enabled,
    },
    seed,
  );
}

export interface SetStatusVars {
  bookId: string;
  /** null removes the book from the library. */
  status: W.ShelfStatus | null;
  /** The book's card, so a first add shows in the library list at once. */
  book?: W.BookRef;
}

export function useSetBookStatus() {
  const api = useApi();
  return useWrite<SetStatusVars>({
    write: ({ bookId, status }) =>
      status === null
        ? api.delete(`/library/${bookId}`)
        : api.put(`/library/${bookId}`, { status }),
    optimistic: ({ bookId, status, book }) => [
      patch<W.LibraryEntry[]>(keys.library, (list) => {
        if (status === null) return list.filter((e) => e.bookId !== bookId);
        if (list.some((e) => e.bookId === bookId)) {
          return list.map((e) =>
            e.bookId === bookId
              ? { ...e, status, finishedAt: status === "finished" ? Date.now() : e.finishedAt }
              : e,
          );
        }
        if (!book) return list;
        return [
          {
            bookId,
            status,
            progressPct: 0,
            title: book.title,
            author: book.author,
            slug: book.slug,
            coverUrl: book.coverUrl,
            updatedAt: Date.now(),
            finishedAt: status === "finished" ? Date.now() : null,
          },
          ...list,
        ];
      }),
      patch<W.MyBookState>(keys.myBook(bookId), (s) => ({ ...s, status })),
    ],
    // A finish moves goal progress and the streak's finished count.
    invalidates: ({ bookId }) => [keys.library, keys.myBook(bookId), keys.goals, keys.streak],
  });
}

// --- Custom shelves ---------------------------------------------------------

export function useShelves<S extends W.Shelf[] | undefined = undefined>(seed?: S) {
  const api = useApi();
  return useSeededQuery(
    {
      queryKey: keys.shelves,
      queryFn: () => api.get<{ shelves: W.Shelf[] }>("/shelves").then((r) => r.shelves),
    },
    seed,
  );
}

export function useShelf<S extends W.ShelfDetail | undefined = undefined>(id: string, seed?: S) {
  const api = useApi();
  return useSeededQuery(
    { queryKey: keys.shelf(id), queryFn: () => api.get<W.ShelfDetail>(`/shelves/${id}`) },
    seed,
  );
}

export function useCreateShelf() {
  const api = useApi();
  return useWrite<{ name: string; description?: string; isPublic?: boolean }, { shelf: W.Shelf }>({
    write: (input) => api.post<{ shelf: W.Shelf }>("/shelves", input),
    invalidates: () => [keys.shelves],
  });
}

export function useDeleteShelf() {
  const api = useApi();
  return useWrite<{ id: string }>({
    write: ({ id }) => api.delete(`/shelves/${id}`),
    optimistic: ({ id }) => [patch<W.Shelf[]>(keys.shelves, (s) => s.filter((x) => x.id !== id))],
    invalidates: ({ id }) => [keys.shelves, keys.shelf(id)],
  });
}

export function useToggleShelfBook() {
  const api = useApi();
  return useWrite<{ shelfId: string; bookId: string; on: boolean }>({
    write: ({ shelfId, bookId, on }) =>
      on
        ? api.post(`/shelves/${shelfId}/books`, { bookId })
        : api.delete(`/shelves/${shelfId}/books/${bookId}`),
    optimistic: ({ shelfId, bookId, on }) => [
      patch<W.MyBookState>(keys.myBook(bookId), (s) => ({
        ...s,
        shelfIds: on
          ? [...new Set([...s.shelfIds, shelfId])]
          : s.shelfIds.filter((x) => x !== shelfId),
      })),
      patch<W.ShelfDetail>(keys.shelf(shelfId), (d) =>
        on ? d : { ...d, books: d.books.filter((b) => b.id !== bookId) },
      ),
    ],
    invalidates: ({ shelfId, bookId }) => [keys.shelf(shelfId), keys.myBook(bookId)],
  });
}

// --- Goals and streak -------------------------------------------------------

export function useGoals<S extends W.GoalWithProgress[] | undefined = undefined>(seed?: S) {
  const api = useApi();
  return useSeededQuery(
    {
      queryKey: keys.goals,
      queryFn: () => api.get<{ goals: W.GoalWithProgress[] }>("/goals").then((r) => r.goals),
    },
    seed,
  );
}

export type NewGoal = Omit<W.Goal, "id" | "month" | "week"> & { month?: number; week?: number };

export function useCreateGoal() {
  const api = useApi();
  return useWrite<NewGoal>({
    write: (input) => api.post("/goals", input),
    invalidates: () => [keys.goals],
  });
}

export function useUpdateGoal() {
  const api = useApi();
  return useWrite<{ id: string; target: number }>({
    write: ({ id, target }) => api.patch(`/goals/${id}`, { target }),
    optimistic: ({ id, target }) => [
      patch<W.GoalWithProgress[]>(keys.goals, (g) =>
        g.map((row) => (row.goal.id === id ? { ...row, goal: { ...row.goal, target } } : row)),
      ),
    ],
    invalidates: () => [keys.goals],
  });
}

export function useDeleteGoal() {
  const api = useApi();
  return useWrite<{ id: string }>({
    write: ({ id }) => api.delete(`/goals/${id}`),
    optimistic: ({ id }) => [
      patch<W.GoalWithProgress[]>(keys.goals, (g) => g.filter((row) => row.goal.id !== id)),
    ],
    invalidates: () => [keys.goals],
  });
}

export function useStreak<S extends W.Streak | undefined = undefined>(seed?: S) {
  const api = useApi();
  return useSeededQuery(
    {
      queryKey: keys.streak,
      queryFn: () => api.get<{ streak: W.Streak }>("/streaks/me").then((r) => r.streak),
    },
    seed,
  );
}

export function useStats<S extends W.ReadingStats | undefined = undefined>(seed?: S) {
  const api = useApi();
  return useSeededQuery(
    { queryKey: keys.stats, queryFn: () => api.get<W.ReadingStats>("/stats") },
    seed,
  );
}

// --- The reader's own annotations, across books --------------------------------

export function useMyAnnotations<S extends W.MyAnnotation[] | undefined = undefined>(
  types: W.AnnotationType[],
  seed?: S,
) {
  const api = useApi();
  const list = types.join(",");
  return useSeededQuery(
    {
      queryKey: keys.myAnnotations(list),
      queryFn: () =>
        api
          .get<{ annotations: W.MyAnnotation[] }>(`/annotations?types=${list}`)
          .then((r) => r.annotations),
    },
    seed,
  );
}

// --- Vocabulary -------------------------------------------------------------

export function useVocabulary<S extends W.VocabularyWord[] | undefined = undefined>(seed?: S) {
  const api = useApi();
  return useSeededQuery(
    {
      queryKey: keys.vocabulary,
      queryFn: () => api.get<{ words: W.VocabularyWord[] }>("/vocabulary").then((r) => r.words),
    },
    seed,
  );
}

export function useSetMastered() {
  const api = useApi();
  return useWrite<{ id: string; mastered: boolean }>({
    write: ({ id, mastered }) => api.patch(`/vocabulary/${id}`, { mastered }),
    optimistic: ({ id, mastered }) => [
      patch<W.VocabularyWord[]>(keys.vocabulary, (words) =>
        words.map((w) => (w.id === id ? { ...w, mastered } : w)),
      ),
    ],
    invalidates: () => [keys.vocabulary],
  });
}

// --- Notifications ----------------------------------------------------------

export function useNotifications<S extends W.NotificationsPage | undefined = undefined>(seed?: S) {
  const api = useApi();
  return useSeededQuery(
    { queryKey: keys.notifications, queryFn: () => api.get<W.NotificationsPage>("/notifications") },
    seed,
  );
}

/** Marks the given notifications read, or all of them when ids is omitted. */
export function useMarkNotificationsRead() {
  const api = useApi();
  return useWrite<{ ids?: string[] } | void>({
    write: (vars) => api.post("/notifications/read", vars?.ids ? { ids: vars.ids } : {}),
    optimistic: (vars) => [
      patch<W.NotificationsPage>(keys.notifications, (page) => {
        const ids = vars?.ids ? new Set(vars.ids) : null;
        const notifications = page.notifications.map((n) =>
          !ids || ids.has(n.id) ? { ...n, isRead: true } : n,
        );
        return { notifications, unread: notifications.filter((n) => !n.isRead).length };
      }),
    ],
    invalidates: () => [keys.notifications],
  });
}
