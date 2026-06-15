'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import {
  RESERVED_PARAMS,
  type FacetConfig,
  type FacetCounts,
  type FilterBarConfig,
} from '@/lib/search/filter-config'
import { useSearchParamsState } from './use-search-params-state'

/**
 * The ONE filter primitive. A page is a FilterBarConfig + <FilterBar/> + the
 * shared results grid -- no bespoke per-page filter components. All state lives
 * in the URL (shareable / SEO / ISR-safe).
 *
 * Consistent layout on every index page: [search] [sort] [Filters (mobile)] on
 * the top row, an active-filter chip row (each removable + "Clear all"), then a
 * facet row (collapsed behind the Filters disclosure on narrow screens). Facet
 * options carry result counts ("Dark (62)"); a 0-count option is disabled so a
 * filter can never lead to an empty grid. Counts come from the query layer.
 */
export function FilterBar({
  config,
  facetCounts = {},
}: {
  config: FilterBarConfig
  facetCounts?: FacetCounts
}) {
  const { get, getAll, setParams } = useSearchParamsState()

  const urlQuery = get(RESERVED_PARAMS.query) ?? ''
  const [text, setText] = useState(urlQuery)
  const [showFacets, setShowFacets] = useState(false)

  // Keep the input in sync if the URL changes externally (back/forward).
  useEffect(() => setText(urlQuery), [urlQuery])

  // Debounce text → URL.
  useEffect(() => {
    if (text === urlQuery) return
    const t = setTimeout(() => setParams({ [RESERVED_PARAMS.query]: text }), 300)
    return () => clearTimeout(t)
  }, [text, urlQuery, setParams])

  const currentSort = get(RESERVED_PARAMS.sort) ?? config.defaultSort

  const selectedValues = (facet: FacetConfig): string[] => {
    if (facet.type === 'chips' && facet.multiple) return getAll(facet.param)
    const v = get(facet.param)
    return v ? [v] : []
  }
  const countFor = (param: string, value: string): number | undefined =>
    facetCounts[param]?.[value]

  // Active-filter chips (each facet selection + the free-text query).
  const activeChips = config.facets.flatMap((facet) => {
    const multiple = facet.type === 'chips' && facet.multiple === true
    return selectedValues(facet).map((value) => ({
      param: facet.param,
      value,
      label: facet.options.find((o) => o.value === value)?.label ?? value,
      multiple,
    }))
  })
  const activeCount = activeChips.length + (urlQuery ? 1 : 0)

  const removeChip = (chip: { param: string; value: string; multiple: boolean }) => {
    if (chip.multiple) {
      setParams({ [chip.param]: getAll(chip.param).filter((v) => v !== chip.value) })
    } else {
      setParams({ [chip.param]: null })
    }
  }
  const clearAll = () => {
    const updates: Record<string, null> = { [RESERVED_PARAMS.query]: null }
    for (const facet of config.facets) updates[facet.param] = null
    setText('')
    setParams(updates)
  }

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
        {config.facets.length > 0 && (
          <button
            type="button"
            aria-expanded={showFacets}
            onClick={() => setShowFacets((v) => !v)}
            className="rounded-full border border-border-subtle bg-bg-surface px-3 py-2 font-dm-sans text-sm text-text-primary hover:border-border-interactive focus:border-border-interactive focus:outline-none sm:hidden"
          >
            Filters
            {activeCount > 0 && (
              <span className="ml-1.5 rounded-full bg-brand-subtle px-1.5 py-0.5 font-dm-mono text-[0.625rem] text-brand-subtle-text">
                {activeCount}
              </span>
            )}
          </button>
        )}
      </div>

      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeChips.map((chip) => (
            <button
              key={`${chip.param}:${chip.value}`}
              type="button"
              onClick={() => removeChip(chip)}
              className="inline-flex items-center gap-1 rounded-full border border-brand-ui bg-brand-subtle px-3 py-1 font-dm-sans text-xs text-brand-subtle-text"
            >
              {chip.label}
              <span aria-hidden className="text-sm leading-none">
                ×
              </span>
              <span className="sr-only">Remove filter</span>
            </button>
          ))}
          <button
            type="button"
            onClick={clearAll}
            className="rounded-full px-2 py-1 font-dm-sans text-xs text-text-tertiary underline-offset-2 hover:text-text-primary hover:underline"
          >
            Clear all
          </button>
        </div>
      )}

      {config.facets.length > 0 && (
        <div
          className={cn(
            'flex-wrap items-start gap-x-6 gap-y-3',
            showFacets ? 'flex' : 'hidden',
            'sm:flex',
          )}
        >
          {config.facets.map((facet) => {
            if (facet.type === 'chips') {
              const selected = selectedValues(facet)
              return (
                <fieldset key={facet.key} className="flex flex-wrap items-center gap-1.5">
                  <legend className="mr-1 font-dm-mono text-[0.6875rem] uppercase tracking-[0.15em] text-text-tertiary">
                    {facet.label}
                  </legend>
                  {facet.options.map((opt) => {
                    const active = selected.includes(opt.value)
                    const count = countFor(facet.param, opt.value)
                    const disabled = count === 0 && !active
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={active}
                        disabled={disabled}
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
                          disabled && 'cursor-not-allowed opacity-40 hover:text-text-tertiary',
                        )}
                      >
                        {opt.label}
                        {count != null && (
                          <span className="ml-1 font-dm-mono text-[0.625rem] opacity-70">
                            {count}
                          </span>
                        )}
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
                  {facet.options.map((opt) => {
                    const count = countFor(facet.param, opt.value)
                    return (
                      <option
                        key={opt.value}
                        value={opt.value}
                        disabled={count === 0 && opt.value !== value}
                      >
                        {opt.label}
                        {count != null ? ` (${count})` : ''}
                      </option>
                    )
                  })}
                </select>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
