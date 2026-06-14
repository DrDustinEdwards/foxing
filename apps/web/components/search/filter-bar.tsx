'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { RESERVED_PARAMS, type FilterBarConfig } from '@/lib/search/filter-config'
import { useSearchParamsState } from './use-search-params-state'

/**
 * The ONE filter primitive. A page is a FilterBarConfig + <FilterBar/> + the
 * shared results grid — no bespoke per-page filter components. All state lives
 * in the URL (shareable / SEO / ISR-safe).
 */
export function FilterBar({ config }: { config: FilterBarConfig }) {
  const { get, getAll, setParams } = useSearchParamsState()

  const urlQuery = get(RESERVED_PARAMS.query) ?? ''
  const [text, setText] = useState(urlQuery)

  // Keep the input in sync if the URL changes externally (back/forward).
  useEffect(() => setText(urlQuery), [urlQuery])

  // Debounce text → URL.
  useEffect(() => {
    if (text === urlQuery) return
    const t = setTimeout(() => setParams({ [RESERVED_PARAMS.query]: text }), 300)
    return () => clearTimeout(t)
  }, [text, urlQuery, setParams])

  const currentSort = get(RESERVED_PARAMS.sort) ?? config.defaultSort

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {config.showSearch !== false && (
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={config.searchPlaceholder}
            aria-label={config.searchPlaceholder}
            className="min-w-[14rem] flex-1 rounded-full border border-border-subtle bg-bg-surface px-4 py-2 font-dm-sans text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-interactive focus:outline-none"
          />
        )}
        {config.sorts.length > 0 && (
          <label className="flex items-center gap-2">
            <span className="sr-only">Sort</span>
            <select
              value={currentSort}
              onChange={(e) =>
                setParams({
                  [RESERVED_PARAMS.sort]:
                    e.target.value === config.defaultSort ? null : e.target.value,
                })
              }
              className="rounded-full border border-border-subtle bg-bg-surface px-3 py-2 font-dm-sans text-sm text-text-primary focus:border-border-interactive focus:outline-none"
            >
              {config.sorts.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {config.facets.length > 0 && (
        <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
          {config.facets.map((facet) => {
            if (facet.type === 'chips') {
              const selected = facet.multiple
                ? getAll(facet.param)
                : [get(facet.param)].filter(Boolean) as string[]
              return (
                <fieldset key={facet.key} className="flex flex-wrap items-center gap-1.5">
                  <legend className="mr-1 font-dm-mono text-[0.6875rem] uppercase tracking-[0.15em] text-text-tertiary">
                    {facet.label}
                  </legend>
                  {facet.options.map((opt) => {
                    const active = selected.includes(opt.value)
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          if (facet.multiple) {
                            const next = active
                              ? selected.filter((v) => v !== opt.value)
                              : [...selected, opt.value]
                            setParams({ [facet.param]: next })
                          } else {
                            setParams({ [facet.param]: active ? null : opt.value })
                          }
                        }}
                        className={cn(
                          'rounded-full border px-3 py-1 font-dm-sans text-xs transition-colors',
                          active
                            ? 'border-brand-ui bg-brand-subtle text-brand-subtle-text'
                            : 'border-border-subtle text-text-tertiary hover:text-text-primary',
                        )}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </fieldset>
              )
            }
            // 'select' and 'range' both render as dropdown(s).
            const value = get(facet.param) ?? ''
            return (
              <label key={facet.key} className="flex items-center gap-2">
                <span className="font-dm-mono text-[0.6875rem] uppercase tracking-[0.15em] text-text-tertiary">
                  {facet.label}
                </span>
                <select
                  value={value}
                  onChange={(e) =>
                    setParams({ [facet.param]: e.target.value || null })
                  }
                  className="rounded-full border border-border-subtle bg-bg-surface px-3 py-1.5 font-dm-sans text-sm text-text-primary focus:border-border-interactive focus:outline-none"
                >
                  <option value="">Any</option>
                  {facet.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
