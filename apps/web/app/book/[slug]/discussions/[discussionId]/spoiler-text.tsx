'use client'

import { useState } from 'react'

export function SpoilerText({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false)
  if (revealed) {
    return (
      <p className="whitespace-pre-line font-source-serif-4 text-base text-text-primary">
        {children}
      </p>
    )
  }
  return (
    <button
      type="button"
      onClick={() => setRevealed(true)}
      className="rounded bg-bg-sunken px-3 py-2 text-left font-dm-sans text-sm text-text-tertiary hover:text-text-primary"
    >
      Contains a spoiler. Tap to reveal.
    </button>
  )
}
