// Social hooks: the feed, profiles, people, reading lists, the diary, reactions and
// search-as-you-type. Follow and close-friend toggles patch every open screen that
// shows them, so a toggle never reloads the page.
import type * as W from "@foxing/types";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { qs } from "./http";
import { keys } from "./keys";
import { useApi } from "./provider";
import { patch, useSeededQuery, useWrite } from "./query";

// --- Reads ------------------------------------------------------------------

export function useFeed<S extends W.FeedPage | undefined = undefined>(
  cursor: number | null,
  seed?: S,
) {
  const api = useApi();
  return useSeededQuery(
    {
      queryKey: [...keys.feed, cursor],
      queryFn: () => api.get<W.FeedPage>(`/feed${qs({ cursor })}`),
    },
    seed,
  );
}

/** The whole feed as pages, for an infinite list (mobile); `fetchNextPage` loads older rows. */
export function useFeedPages() {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: [...keys.feed, "pages"],
    queryFn: ({ pageParam }) => api.get<W.FeedPage>(`/feed${qs({ cursor: pageParam })}`),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => last.nextCursor,
  });
}

/** The words after the actor's name on a feed row, the same on web and mobile. */
export function activityText(row: Extract<W.FeedRow, { kind: "activity" }>): string {
  const title = typeof row.data.title === "string" ? row.data.title : "a book";
  switch (row.type) {
    case "finished_book":
      return `finished ${title}`;
    case "started_book":
      return `started reading ${title}`;
    case "reviewed":
      return `reviewed ${title}`;
    case "rated":
      return `rated ${title}`;
    case "highlighted":
      return `highlighted a passage in ${title}`;
    case "joined_club":
      return "joined a club";
    case "list_created":
      return `created a list${typeof row.data.title === "string" ? `: ${row.data.title}` : ""}`;
    default:
      return row.type.replace(/_/g, " ");
  }
}

export function useProfilePage<S extends W.ProfilePage | undefined = undefined>(
  username: string,
  seed?: S,
) {
  const api = useApi();
  return useSeededQuery(
    {
      queryKey: keys.profile(username),
      queryFn: () => api.get<W.ProfilePage>(`/u/${encodeURIComponent(username)}`),
    },
    seed,
  );
}

export function usePeople<S extends W.PeoplePage | undefined = undefined>(seed?: S) {
  const api = useApi();
  return useSeededQuery(
    { queryKey: keys.people, queryFn: () => api.get<W.PeoplePage>("/people") },
    seed,
  );
}

export function useDiary<S extends W.DiaryEntry[] | undefined = undefined>(seed?: S) {
  const api = useApi();
  return useSeededQuery(
    {
      queryKey: keys.diary,
      queryFn: () => api.get<{ entries: W.DiaryEntry[] }>("/diary").then((r) => r.entries),
    },
    seed,
  );
}

/** The reader's own Year in Reading for one year. */
export function useRecap(year: number) {
  const api = useApi();
  return useQuery({
    queryKey: keys.recap(year),
    queryFn: () => api.get<W.RecapPage>(`/recap/${year}`),
  });
}

export function useMyLists<S extends W.MyList[] | undefined = undefined>(seed?: S) {
  const api = useApi();
  return useSeededQuery(
    { queryKey: keys.myLists, queryFn: () => api.get<W.MyList[]>("/lists") },
    seed,
  );
}

export function useListPage<S extends W.ListPage | undefined = undefined>(id: string, seed?: S) {
  const api = useApi();
  return useSeededQuery(
    { queryKey: keys.list(id), queryFn: () => api.get<W.ListPage>(`/lists/${id}`) },
    seed,
  );
}

const NO_SUGGESTIONS: W.SearchSuggest = { books: [], authors: [], people: [], clubs: [] };

/** Debounced search-as-you-type. Under two characters it is empty and fetches nothing;
 *  while a new term loads, the last answer stays on screen. */
export function useSuggest(q: string, delayMs = 180): W.SearchSuggest {
  const api = useApi();
  const trimmed = q.trim();
  const [term, setTerm] = useState(trimmed);
  useEffect(() => {
    const t = setTimeout(() => setTerm(trimmed), delayMs);
    return () => clearTimeout(t);
  }, [trimmed, delayMs]);
  const enabled = term.length >= 2 && trimmed.length >= 2;
  const { data } = useQuery({
    queryKey: keys.suggest(term),
    queryFn: ({ signal }) => api.get<W.SearchSuggest>(`/search/suggest${qs({ q: term })}`, signal),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
  return enabled ? (data ?? NO_SUGGESTIONS) : NO_SUGGESTIONS;
}

// --- Follows and close friends ----------------------------------------------

function patchProfile(
  userId: string,
  update: (p: W.ProfilePage & { isPrivate: false }) => W.ProfilePage,
) {
  return patch<W.ProfilePage>(keys.profiles, (page) =>
    !page.isPrivate && page.profile.id === userId ? update(page) : page,
  );
}

export function useFollow() {
  const api = useApi();
  return useWrite<{ userId: string; on: boolean }>({
    write: ({ userId, on }) =>
      on ? api.put(`/follows/${userId}`) : api.delete(`/follows/${userId}`),
    optimistic: ({ userId, on }) => [
      patchProfile(userId, (p) =>
        p.isFollowing === on
          ? p
          : { ...p, isFollowing: on, followerCount: Math.max(0, p.followerCount + (on ? 1 : -1)) },
      ),
      patch<W.PeoplePage>(keys.people, (people) => ({
        ...people,
        followers: people.followers.map((f) => (f.id === userId ? { ...f, isFollowing: on } : f)),
      })),
    ],
    invalidates: () => [keys.profiles, keys.people, keys.feed],
  });
}

export function useCloseFriend() {
  const api = useApi();
  return useWrite<{ userId: string; on: boolean }>({
    write: ({ userId, on }) =>
      on ? api.put(`/close-friends/${userId}`) : api.delete(`/close-friends/${userId}`),
    optimistic: ({ userId, on }) => [
      patchProfile(userId, (p) => ({ ...p, viewerHasAsCloseFriend: on })),
      patch<W.PeoplePage>(keys.people, (people) => {
        const person = [...people.following, ...people.followers].find((p) => p.id === userId);
        const closeFriends = people.closeFriends.filter((p) => p.id !== userId);
        if (on && person) {
          closeFriends.push({
            id: person.id,
            username: person.username,
            displayName: person.displayName,
            avatarUrl: person.avatarUrl,
          });
        }
        return {
          ...people,
          following: people.following.map((f) => (f.id === userId ? { ...f, isClose: on } : f)),
          closeFriends,
        };
      }),
    ],
    invalidates: () => [keys.profiles, keys.people],
  });
}

// --- Reactions --------------------------------------------------------------

export function useReaction() {
  const api = useApi();
  return useWrite<{ targetType: W.ReactionTarget; targetId: string; on: boolean; kind?: string }>({
    write: ({ targetType, targetId, on, kind = "like" }) => {
      const body = { targetType, targetId, kind };
      return on ? api.put("/reactions", body) : api.delete("/reactions", body);
    },
    optimistic: ({ targetType, targetId, on }) =>
      targetType === "reading_list"
        ? [
            patch<W.ListPage>(keys.list(targetId), (l) =>
              l.liked === on
                ? l
                : { ...l, liked: on, likeCount: Math.max(0, l.likeCount + (on ? 1 : -1)) },
            ),
          ]
        : [],
    invalidates: ({ targetType, targetId }) =>
      targetType === "reading_list" ? [keys.list(targetId)] : [],
  });
}

// --- Reading lists ----------------------------------------------------------

export interface ListInput {
  title: string;
  description: string | null;
  isPublic: boolean;
}

export function useCreateList() {
  const api = useApi();
  return useWrite<ListInput, { list: { id: string } }>({
    write: (input) => api.post("/lists", { ...input }),
    invalidates: () => [keys.myLists, keys.profiles, keys.feed],
  });
}

export function useUpdateList() {
  const api = useApi();
  return useWrite<ListInput & { id: string }>({
    write: ({ id, ...input }) => api.patch(`/lists/${id}`, input),
    optimistic: ({ id, ...input }) => [
      patch<W.ListPage>(keys.list(id), (l) => ({ ...l, list: { ...l.list, ...input } })),
    ],
    invalidates: ({ id }) => [keys.list(id), keys.myLists, keys.profiles],
  });
}

export function useDeleteList() {
  const api = useApi();
  return useWrite<{ id: string }>({
    write: ({ id }) => api.delete(`/lists/${id}`),
    optimistic: ({ id }) => [
      patch<W.MyList[]>(keys.myLists, (ls) => ls.filter((l) => l.id !== id)),
    ],
    invalidates: ({ id }) => [keys.list(id), keys.myLists, keys.profiles],
  });
}

export function useAddListBook() {
  const api = useApi();
  return useWrite<{ listId: string; bookId: string; note?: string }>({
    write: ({ listId, ...input }) => api.put(`/lists/${listId}/books`, input),
    invalidates: ({ listId }) => [keys.list(listId), keys.myLists],
  });
}

export function useRemoveListBook() {
  const api = useApi();
  return useWrite<{ listId: string; bookId: string }>({
    write: ({ listId, bookId }) => api.delete(`/lists/${listId}/books/${bookId}`),
    optimistic: ({ listId, bookId }) => [
      patch<W.ListPage>(keys.list(listId), (l) => ({
        ...l,
        books: l.books.filter((b) => b.bookId !== bookId),
      })),
    ],
    invalidates: ({ listId }) => [keys.list(listId), keys.myLists],
  });
}

// --- Diary ------------------------------------------------------------------

export interface DiaryInput {
  bookId: string;
  ratingHalf?: number | null;
  review?: string | null;
  containsSpoilers?: boolean;
  visibility?: W.Visibility;
  logDate?: number;
}

/** A diary write moves the diary, the reader's profile, the feed and goal progress. */
const DIARY_TOUCHES = [keys.diary, keys.profiles, keys.feed, keys.goals, keys.streak];

export function useCreateDiaryEntry() {
  const api = useApi();
  return useWrite<DiaryInput, { entry: { id: string } }>({
    write: (input) => api.post("/diary", { ...input }),
    invalidates: ({ bookId }) => [...DIARY_TOUCHES, keys.myBook(bookId)],
  });
}

export function useUpdateDiaryEntry() {
  const api = useApi();
  return useWrite<Partial<DiaryInput> & { id: string }>({
    write: ({ id, bookId: _bookId, ...input }) => api.patch(`/diary/${id}`, input),
    invalidates: () => DIARY_TOUCHES,
  });
}

export function useDeleteDiaryEntry() {
  const api = useApi();
  return useWrite<{ id: string }>({
    write: ({ id }) => api.delete(`/diary/${id}`),
    optimistic: ({ id }) => [
      patch<W.DiaryEntry[]>(keys.diary, (d) => d.filter((e) => e.id !== id)),
    ],
    invalidates: () => DIARY_TOUCHES,
  });
}
