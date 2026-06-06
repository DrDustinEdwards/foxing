'use client'

import { useState } from 'react'

export function SeoPreview({
  slug,
  title,
  excerpt,
  ogTitle,
  ogDescription,
}: {
  slug: string
  title: string
  excerpt: string
  ogTitle: string
  ogDescription: string
}) {
  const [tab, setTab] = useState<'search' | 'social'>('search')
  const effectiveTitle = ogTitle.trim() || title.trim() || 'Untitled'
  const effectiveDesc = ogDescription.trim() || excerpt.trim() || ''
  const titleOver = effectiveTitle.length > 60
  const descOver = effectiveDesc.length > 160
  const shownTitle = titleOver
    ? `${effectiveTitle.slice(0, 60).trimEnd()}...`
    : effectiveTitle
  const shownDesc = descOver
    ? `${effectiveDesc.slice(0, 160).trimEnd()}...`
    : effectiveDesc

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-dm-sans text-sm text-text-secondary">SEO preview</p>
        <div className="flex gap-1 rounded-md border border-border-subtle p-0.5">
          {(['search', 'social'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded px-2 py-0.5 font-dm-sans text-xs ${
                tab === t
                  ? 'bg-brand-subtle text-brand-subtle-text'
                  : 'text-text-tertiary hover:text-text-primary'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {tab === 'search' ? (
        <div className="flex flex-col gap-1">
          <p className="font-dm-mono text-xs text-text-tertiary">
            foxing.app › journal › {slug || '...'}
          </p>
          <p className="font-fraunces text-base text-brand-text line-clamp-2">
            <span className={titleOver ? 'text-error' : ''}>{shownTitle}</span>
          </p>
          <p className="font-source-serif-4 text-sm text-text-secondary line-clamp-2">
            <span className={descOver ? 'text-error' : ''}>{shownDesc}</span>
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border-subtle bg-brand-subtle">
          <div className="aspect-[2/1] bg-bg-sunken" aria-hidden="true" />
          <div className="flex flex-col gap-1 p-4">
            <p className="font-dm-mono text-xs text-text-tertiary">foxing.app</p>
            <p className="font-fraunces text-base text-text-primary line-clamp-2">
              {shownTitle}
            </p>
            <p className="font-source-serif-4 text-sm text-text-secondary line-clamp-2">
              {shownDesc}
            </p>
          </div>
        </div>
      )}
      <p className="flex gap-3 font-dm-mono text-xs">
        <span className={titleOver ? 'text-error' : 'text-text-tertiary'}>
          Title: {effectiveTitle.length} / 60
        </span>
        <span className={descOver ? 'text-error' : 'text-text-tertiary'}>
          Description: {effectiveDesc.length} / 160
        </span>
      </p>
    </div>
  )
}
