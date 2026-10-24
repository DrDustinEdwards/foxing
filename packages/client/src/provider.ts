// The provider both apps mount once at the root: a QueryClient with Foxing's
// defaults and the ApiClient the hooks call. Written with createElement so the
// package needs no JSX setup of its own.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, createElement, type ReactNode, useContext } from "react";
import { ApiError, type ApiClient } from "./http";

const ApiContext = createContext<ApiClient | null>(null);

export function useApi(): ApiClient {
  const api = useContext(ApiContext);
  if (!api) throw new Error("useApi needs <FoxingDataProvider> above it.");
  return api;
}

/** Reads stay fresh for 30 seconds (a loader-seeded page does not refetch on mount);
 *  4xx answers are not retried, and writes are never retried (the reader sees the
 *  error and decides). */
export function createFoxingQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (count, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
      },
      mutations: { retry: false },
    },
  });
}

export function FoxingDataProvider({
  api,
  queryClient,
  children,
}: {
  api: ApiClient;
  queryClient: QueryClient;
  children: ReactNode;
}) {
  return createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(ApiContext.Provider, { value: api }, children),
  );
}
