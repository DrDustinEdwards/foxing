// Catalog hooks: browse, search, a book page, an author page and recommendations.
// All but recommendations are the same for every reader.
import type * as W from "@foxing/types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { qs } from "./http";
import { type CatalogQuery, keys } from "./keys";
import { useApi } from "./provider";
import { useSeededQuery, useWrite } from "./query";

export function useBrowse(query: CatalogQuery) {
  const api = useApi();
  return useQuery({
    queryKey: keys.browse(query),
    queryFn: () => api.get<W.BrowsePage>(`/books${qs({ ...query })}`),
    placeholderData: keepPreviousData,
  });
}

/** Full search; nothing is fetched until there is a query. */
export function useSearch(q: string, query: CatalogQuery = {}) {
  const api = useApi();
  const term = q.trim();
  return useQuery({
    queryKey: keys.search(term, query),
    queryFn: () => api.get<W.SearchPage>(`/search${qs({ q: term, ...query })}`),
    enabled: term.length > 0,
    placeholderData: keepPreviousData,
  });
}

export function useBookPage<S extends W.BookPage | undefined = undefined>(
  idOrSlug: string,
  seed?: S,
) {
  const api = useApi();
  return useSeededQuery(
    {
      queryKey: keys.book(idOrSlug),
      queryFn: () => api.get<W.BookPage>(`/books/${encodeURIComponent(idOrSlug)}`),
    },
    seed,
  );
}

export function useAuthor<S extends W.AuthorPage | undefined = undefined>(slug: string, seed?: S) {
  const api = useApi();
  return useSeededQuery(
    {
      queryKey: keys.author(slug),
      queryFn: () => api.get<W.AuthorPage>(`/authors/${encodeURIComponent(slug)}`),
    },
    seed,
  );
}

export function useRecommendations<S extends W.Recommendations | undefined = undefined>(seed?: S) {
  const api = useApi();
  return useSeededQuery(
    {
      queryKey: keys.recommendations,
      queryFn: () => api.get<W.Recommendations>("/recommendations"),
    },
    seed,
  );
}

/** Asks for a fresh set (the AI tier re-picks for Plus readers) and swaps it in. */
export function useRefreshRecommendations() {
  const api = useApi();
  return useWrite<void, W.Recommendations>({
    write: () => api.get<W.Recommendations>("/recommendations?refresh=1"),
    invalidates: () => [keys.recommendations],
  });
}
