'use client'

import Link from 'next/link'
import { useState } from 'react'
import { cn } from '@/lib/cn'
import { Select } from '@/components/ui/select'

interface Props {
  current: { year: number; month: number }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function shortLabel(month: number, year: number): string {
  const name = new Date(2000, month - 1, 1).toLocaleString('en-US', {
    month: 'short',
  })
  return `${name} ${year}`
}

export function MonthTabs({ current }: Props) {
  const now = new Date()
  const nowYear = now.getUTCFullYear()
  const nowMonth = now.getUTCMonth() + 1

  // Last month tab
  const lastMonthDate = new Date(Date.UTC(nowYear, nowMonth - 2, 1))
  const lastYear = lastMonthDate.getUTCFullYear()
  const lastMonth = lastMonthDate.getUTCMonth() + 1

  const isThis = current.year === nowYear && current.month === nowMonth
  const isLast = current.year === lastYear && current.month === lastMonth

  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickYear, setPickYear] = useState(current.year)
  const [pickMonth, setPickMonth] = useState(current.month)

  function tabHref(y: number, m: number): string {
    return `/admin/celebrity-picks?year=${y}&month=${pad(m)}`
  }

  return (
    <nav
      aria-label="Month tabs"
      className="mt-6 flex flex-wrap items-center gap-2 border-b border-border-subtle pb-3"
    >
      <Link
        href={tabHref(nowYear, nowMonth)}
        className={cn(
          'rounded-md px-3 py-1.5 font-dm-sans text-sm',
          isThis
            ? 'bg-brand-subtle text-brand-subtle-text'
            : 'text-text-tertiary hover:text-text-primary',
        )}
      >
        This month
      </Link>
      <Link
        href={tabHref(lastYear, lastMonth)}
        className={cn(
          'rounded-md px-3 py-1.5 font-dm-sans text-sm',
          isLast
            ? 'bg-brand-subtle text-brand-subtle-text'
            : 'text-text-tertiary hover:text-text-primary',
        )}
      >
        Last month
      </Link>
      {!isThis && !isLast && (
        <span className="rounded-md bg-brand-subtle px-3 py-1.5 font-dm-sans text-sm text-brand-subtle-text">
          {shortLabel(current.month, current.year)}
        </span>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className="rounded-md px-3 py-1.5 font-dm-sans text-sm text-text-tertiary hover:text-text-primary"
        >
          Jump to month
        </button>
        {pickerOpen && (
          <div className="absolute left-0 top-full z-20 mt-2 flex flex-col gap-2 rounded-md border border-border-subtle bg-bg-elevated p-3 shadow-md">
            <div className="flex items-center gap-2">
              <label className="font-dm-sans text-xs text-text-tertiary">
                Year
              </label>
              <input
                type="number"
                min={2000}
                max={2100}
                value={pickYear}
                onChange={(e) => setPickYear(Number(e.target.value))}
                className="h-8 w-20 rounded border border-border-interactive bg-bg-surface px-2 font-dm-mono text-sm text-text-primary"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="font-dm-sans text-xs text-text-tertiary">
                Month
              </label>
              <Select
                aria-label="Month"
                value={String(pickMonth)}
                onChange={(v) => setPickMonth(Number(v))}
                size="sm"
                options={Array.from({ length: 12 }, (_, i) => i + 1).map(
                  (m) => ({
                    value: String(m),
                    label: new Date(2000, m - 1, 1).toLocaleString('en-US', {
                      month: 'long',
                    }),
                  }),
                )}
              />
            </div>
            <Link
              href={tabHref(pickYear, pickMonth)}
              className="rounded-md bg-brand-ui px-3 py-1.5 text-center font-dm-sans text-xs font-medium text-text-on-amber hover:bg-brand-hover"
              onClick={() => setPickerOpen(false)}
            >
              Go
            </Link>
          </div>
        )}
      </div>
    </nav>
  )
}
