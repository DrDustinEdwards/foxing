'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { Select, type SelectOption } from '@/components/ui/select'
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
 * Progressive disclosure (eBay / Maps / Booking 2026): a single control row
 * [search ....] [Filters (n)] [Sort], with the facet controls collapsed behind
 * the Filters button on every breakpoint -- a popover on desktop, a bottom
 * sheet on mobile. Active selections surface as removable chips just below the
 * row, so the panel can stay shut. Facet options carry result counts and 0-count
 * options are disabled. Counts come from the query layer.
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
  const [open, setOpen] = useState(false)

  // Keep the input in sync if the URL changes externally (back/forward).
  useEffect(() => setText(urlQuery), [urlQuery])

  // Debounce text → URL.
  useEffect(() => {
    if (text === urlQuery) return
    const t = setTimeout(() => setParams({ [RESERVED_PARAMS.query]: text }), 300)
    return () => clearTimeout(t)
  }, [text, urlQuery, setParams])

  // Close the disclosure on Escape.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const currentSort = get(RESERVED_PARAMS.sort) ?? config.defaultSort
  const hasFacets = config.facets.length > 0

  const selectedValues = (facet: FacetConfig): string[] => {
    if (facet.type === 'chips' && facet.multiple) return getAll(facet.param)
    const v = get(facet.param)
    return v ? [v] : []
  }
  const countFor = (param: string, value: string): number | undefined =>
    facetCounts[param]?.[value]

  // Active-filter chips (one per selected facet value).
  const activeChips = config.facets.flatMap((facet) => {
    const multiple = facet.type === 'chips' && facet.multiple === true
    return selectedValues(facet).map((value) => ({
      param: facet.param,
      value,
      label: facet.options.find((o) => o.value === value)?.label ?? value,
      multiple,
    }))
  })
  const activeCount = activeChips.length

  const removeChip = (chip: { param: string; value: string; multiple: boolean }) => {
    if (chip.multiple) {
      setParams({ [chip.param]: getAll(chip.param).filter((v) => v !== chip.value) })
    } else {
      setParams({ [chip.param]: null })
    }
  }
  const clearAll = () => {
    const updates: Record<string, null> = {}
    for (const facet of config.facets) updates[facet.param] = null
    setParams(updates)
  }

  const inputCls =
    'rounded-full border border-border-subtle bg-bg-surface px-4 py-2 font-dm-sans text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-interactive focus:outline-none'

  function renderFacet(facet: FacetConfig) {
    if (facet.type === 'chips') {
      const selected = selectedValues(facet)
      return (
        <fieldset key={facet.key} className="flex flex-col gap-2">
          <legend className="font-dm-mono text-[0.6875rem] uppercase tracking-[0.15em] text-text-tertiary">
            {facet.label}
          </legend>
          <div className="flex flex-wrap gap-1.5">
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
          </div>
        </fieldset>
      )
    }
    // 'select' and 'range' both render as a dropdown.
    const value = get(facet.param) ?? ''
    const selectOptions: SelectOption[] = [
      { value: '', label: 'Any' },
      ...facet.options.map((opt) => {
        const count = countFor(facet.param, opt.value)
        return {
          value: opt.value,
          label: opt.label,
          count,
          disabled: count === 0 && opt.value !== value,
        }
      }),
    ]
    return (
      <label key={facet.key} className="flex flex-col gap-2">
        <span className="font-dm-mono text-[0.6875rem] uppercase tracking-[0.15em] text-text-tertiary">
          {facet.label}
        </span>
        <Select
          value={value}
          onChange={(v) => setParams({ [facet.param]: v || null })}
          options={selectOptions}
          aria-label={facet.label}
          className="w-full"
        />
      </label>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Control row: [search ....] [Filters (n)] [Sort] */}
      <div className="flex flex-wrap items-center gap-2">
        {config.showSearch !== false && (
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={config.searchPlaceholder}
            aria-label={config.searchPlaceholder}
            className={cn('min-w-[12rem] flex-1', inputCls)}
          />
        )}

        {hasFacets && (
          <div className="relative">
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-bg-surface px-3 py-2 font-dm-sans text-sm text-text-primary hover:border-border-interactive focus:border-border-interactive focus:outline-none"
            >
              Filters
              {activeCount > 0 && (
                <span className="rounded-full bg-brand-subtle px-1.5 py-0.5 font-dm-mono text-[0.625rem] text-brand-subtle-text">
                  {activeCount}
                </span>
              )}
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden
                className={cn('transition-transform', open && 'rotate-180')}
              >
                <path
                  d="M3 4.5L6 7.5L9 4.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {open && (
              <>
                <div
                  aria-hidden
                  onClick={() => setOpen(false)}
                  className="fixed inset-0 z-40 bg-black/20 sm:bg-transparent"
                />
                <div
                  role="dialog"
                  aria-label="Filters"
                  className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-auto rounded-t-2xl border border-border-subtle bg-bg-surface p-4 shadow-lg sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:mt-2 sm:max-h-[70vh] sm:w-[22rem] sm:rounded-xl"
                >
                  <div className="mb-3 flex items-center justify-between sm:hidden">
                    <span className="font-fraunces text-base text-text-primary">
                      Filters
                    </span>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="font-dm-sans text-sm text-brand-text"
                    >
                      Done
                    </button>
                  </div>

                  <div className="flex flex-col gap-4">
                    {config.facets.map((facet) => renderFacet(facet))}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border-subtle pt-3">
                    <button
                      type="button"
                      onClick={clearAll}
                      disabled={activeCount === 0}
                      className="font-dm-sans text-xs text-text-tertiary underline-offset-2 hover:text-text-primary hover:underline disabled:opacity-40 disabled:no-underline disabled:hover:text-text-tertiary"
                    >
                      Clear all
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="hidden font-dm-sans text-xs text-brand-text sm:inline"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {config.sorts.length > 0 && (
          <Select
            aria-label="Sort"
            value={currentSort}
            onChange={(v) =>
              setParams({
                [RESERVED_PARAMS.sort]: v === config.defaultSort ? null : v,
              })
            }
            options={config.sorts.map((s) => ({ value: s.value, label: s.label }))}
          />
        )}
      </div>

      {/* Active selections, visible without opening the panel. */}
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
    </div>
  )
}
