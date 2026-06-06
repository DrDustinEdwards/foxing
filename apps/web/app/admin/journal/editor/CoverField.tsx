'use client'

import type { ChangeEvent } from 'react'
import { Input } from '@/components/ui/input'

export function CoverField({
  url,
  uploading,
  onPick,
  onRemove,
  onUrlChange,
  alt,
  onAltChange,
}: {
  url: string
  uploading: boolean
  onPick: (e: ChangeEvent<HTMLInputElement>) => void
  onRemove: () => void
  onUrlChange: (v: string) => void
  alt: string
  onAltChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-bg-surface p-4">
      <p className="font-dm-sans text-sm text-text-secondary">Cover image</p>
      <div className="flex flex-wrap items-start gap-4">
        {url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={url}
            alt="Cover preview"
            className="h-32 w-48 rounded border border-border-subtle object-cover"
          />
        ) : (
          <div className="flex h-32 w-48 items-center justify-center rounded border border-dashed border-border-subtle bg-bg-sunken font-dm-mono text-xs text-text-tertiary">
            No cover yet
          </div>
        )}
        <div className="flex flex-1 flex-col gap-2">
          <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-border-subtle bg-bg-base px-3 py-2 font-dm-sans text-sm text-text-primary hover:border-brand-ui">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={onPick}
            />
            {uploading ? 'Uploading...' : 'Upload image'}
          </label>
          <Input
            label="Or paste a URL"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://..."
          />
          {url && (
            <button
              type="button"
              onClick={onRemove}
              className="self-start font-dm-sans text-xs text-text-tertiary hover:text-error"
            >
              Remove cover
            </button>
          )}
        </div>
      </div>
      <Input
        label="Cover alt text (for screen readers and SEO)"
        value={alt}
        onChange={(e) => onAltChange(e.target.value)}
        placeholder="Describe the cover image in one sentence."
      />
    </div>
  )
}
