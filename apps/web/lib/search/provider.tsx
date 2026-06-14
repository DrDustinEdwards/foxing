'use client'

/**
 * Shared TanStack Query provider for the search core (palette + per-page
 * filters). Mount once near the app root when the first consumer ships.
 * Not yet mounted — STEP 1 is the foundation only.
 */
import {
  QueryClient,
  QueryClientProvider,
  isServer,
} from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Search results are cheap to refetch but stable for a few seconds of
        // typing/navigation; tune per consumer if needed.
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

function getQueryClient() {
  if (isServer) return makeQueryClient()
  browserQueryClient ??= makeQueryClient()
  return browserQueryClient
}

export function SearchQueryProvider({ children }: { children: ReactNode }) {
  // Stable client across renders; server gets a fresh one per request.
  const [client] = useState(getQueryClient)
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
