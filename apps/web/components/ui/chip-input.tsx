'use client'

import { useState, useId, type KeyboardEvent } from 'react'
import { cn } from '@/lib/cn'

interface ChipInputProps {
  label: string
  name: string
  initial?: string[]
  suggestions?: readonly string[]
  hint?: string
  placeholder?: string
}

/**
 * Token entry field. Renders as visible chips with a hidden input named
 * `${name}_json` carrying the JSON-encoded array. Server actions parse
 * that input and ignore the visible text box.
 */
export function ChipInput({
  label,
  name,
  initial = [],
  suggestions,
  hint,
  placeholder,
}: ChipInputProps) {
  const [chips, setChips] = useState<string[]>(initial)
  const [draft, setDraft] = useState('')
  const id = useId()

  function addChip(value: string) {
    const trimmed = value.trim().toLowerCase()
    if (!trimmed) return
    if (chips.includes(trimmed)) {
      setDraft('')
      return
    }
    setChips((prev) => [...prev, trimmed])
    setDraft('')
  }

  function removeChip(value: string) {
    setChips((prev) => prev.filter((c) => c !== value))
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addChip(draft)
      return
    }
    if (e.key === 'Backspace' && draft.length === 0 && chips.length > 0) {
      e.preventDefault()
      setChips((prev) => prev.slice(0, -1))
    }
  }

  const availableSuggestions = suggestions?.filter(
    (s) => !chips.includes(s.toLowerCase()),
  )

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-dm-sans text-sm text-text-secondary">
        {label}
      </label>
      <div
        className={cn(
          'flex flex-wrap gap-1.5 rounded-md border border-border-interactive bg-bg-surface p-2',
        )}
      >
        {chips.map((c) => (
          <span
            key={c}
            className="inline-flex items-center gap-1 rounded-full bg-brand-subtle px-2.5 py-0.5 font-dm-sans text-sm text-brand-subtle-text"
          >
            {c}
            <button
              type="button"
              onClick={() => removeChip(c)}
              aria-label={`Remove ${c}`}
              className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-bg-hover"
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => draft && addChip(draft)}
          placeholder={chips.length === 0 ? placeholder ?? 'Type and press Enter' : ''}
          className="min-w-[100px] flex-1 bg-transparent font-dm-sans text-sm text-text-primary outline-none"
        />
      </div>
      <input type="hidden" name={`${name}_json`} value={JSON.stringify(chips)} />
      {availableSuggestions && availableSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {availableSuggestions.map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => addChip(s)}
              className="rounded-full border border-border-subtle px-2 py-0.5 font-dm-sans text-xs text-text-tertiary hover:bg-bg-hover hover:text-text-primary"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
      {hint && (
        <span className="font-dm-mono text-xs text-text-tertiary">{hint}</span>
      )}
    </div>
  )
}
