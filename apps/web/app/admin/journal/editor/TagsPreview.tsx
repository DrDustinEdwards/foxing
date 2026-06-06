'use client'

import { JOURNAL_TAGS } from '@/lib/journal-shared'

export function TagsPreview({ value }: { value: string }) {
  const tags = value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
  const valid = new Set<string>(JOURNAL_TAGS.map((t) => t.slug))
  const canonical = JOURNAL_TAGS.map((t) => t.slug).join(', ')
  return (
    <div className="flex flex-col gap-1">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => {
            const ok = valid.has(t)
            return (
              <span
                key={t}
                className={`rounded-full border px-2 py-0.5 font-dm-mono text-[0.6875rem] ${
                  ok
                    ? 'bg-brand-subtle text-brand-text border-brand-ui'
                    : 'bg-error-bg text-error border-error'
                }`}
              >
                {t}
              </span>
            )
          })}
        </div>
      )}
      <p className="font-dm-mono text-xs text-text-tertiary">
        Valid tags: {canonical}
      </p>
    </div>
  )
}
