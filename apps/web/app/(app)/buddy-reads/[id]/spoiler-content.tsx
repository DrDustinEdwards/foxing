'use client'

import { useState } from 'react'
import { cn } from '@/lib/cn'

export function SpoilerContent({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false)
  return (
    <button
      type="button"
      onClick={() => setRevealed(true)}
      disabled={revealed}
      className={cn(
        'whitespace-pre-line text-left font-source-serif-4 text-sm text-text-primary',
        !revealed && 'select-none rounded bg-bg-sunken px-2 py-1 text-text-tertiary hover:text-text-primary',
      )}
      aria-pressed={revealed}
      aria-label={revealed ? 'Spoiler revealed' : 'Tap to reveal spoiler'}
    >
      {revealed ? children : 'Spoiler: tap to reveal'}
    </button>
  )
}
