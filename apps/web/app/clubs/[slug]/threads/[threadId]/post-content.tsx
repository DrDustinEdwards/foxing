'use client'

import { useState } from 'react'

/**
 * Renders a post body with two guards: a mod-removed post shows a tombstone
 * instead of its text, and a spoiler-tagged post is blurred until the reader
 * clicks to reveal (blur-until-click).
 */
export function PostContent({
  content,
  hasSpoiler,
  isRemoved,
  removedReason,
}: {
  content: string
  hasSpoiler: boolean
  isRemoved: boolean
  removedReason: string | null
}) {
  const [revealed, setRevealed] = useState(false)

  if (isRemoved) {
    return (
      <p className="mt-3 font-source-serif-4 text-base italic text-text-tertiary">
        Removed by a moderator{removedReason ? `: ${removedReason}` : ''}.
      </p>
    )
  }

  if (hasSpoiler && !revealed) {
    return (
      <button
        type="button"
        onClick={() => setRevealed(true)}
        className="group relative mt-3 block w-full overflow-hidden rounded-md text-left"
        aria-label="Reveal spoiler"
      >
        <p className="select-none whitespace-pre-line font-source-serif-4 text-base text-text-primary blur-sm">
          {content}
        </p>
        <span className="absolute inset-0 flex items-center justify-center bg-bg-sunken/70 font-dm-mono text-xs uppercase tracking-wider text-text-secondary">
          Spoiler · click to reveal
        </span>
      </button>
    )
  }

  return (
    <p className="mt-3 whitespace-pre-line font-source-serif-4 text-base text-text-primary">
      {content}
    </p>
  )
}
