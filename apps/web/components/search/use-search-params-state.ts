'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

/**
 * Read/write URL search params for the FilterBar. Filters live in the URL so
 * they are shareable, SEO-friendly, and ISR-safe. Mutating a filter resets the
 * pagination cursor by default.
 */
export function useSearchParamsState() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const setParams = useCallback(
    (
      updates: Record<string, string | string[] | null | undefined>,
      opts?: { resetCursor?: boolean },
    ) => {
      const next = new URLSearchParams(params?.toString() ?? '')
      // Pages paginate with ?page=N (numbered) behind the cursor; reset both so
      // changing a filter/sort/query always returns to the first page.
      if (opts?.resetCursor !== false) {
        next.delete('cursor')
        next.delete('page')
      }
      for (const [key, value] of Object.entries(updates)) {
        next.delete(key)
        if (value == null || value === '') continue
        if (Array.isArray(value)) {
          for (const v of value) if (v) next.append(key, v)
        } else {
          next.set(key, value)
        }
      }
      const qs = next.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [params, pathname, router],
  )

  const get = useCallback(
    (key: string) => params?.get(key) ?? undefined,
    [params],
  )
  const getAll = useCallback(
    (key: string) => params?.getAll(key) ?? [],
    [params],
  )

  return { params, get, getAll, setParams }
}
