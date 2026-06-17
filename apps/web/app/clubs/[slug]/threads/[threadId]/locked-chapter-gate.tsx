'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'

/**
 * Wraps a locked-chapter thread's posts in a spoiler gate: blurred until the
 * reader clicks to reveal, matching the per-post blur-until-click pattern.
 * Only rendered for readers who are not the thread author or a club mod.
 */
export function LockedChapterGate({
  unlockLabel,
  children,
}: {
  unlockLabel: string | null
  children: ReactNode
}) {
  const [revealed, setRevealed] = useState(false)

  if (revealed) return <>{children}</>

  return (
    <button
      type="button"
      onClick={() => setRevealed(true)}
      aria-label="Reveal locked chapter discussion"
      className="relative block w-full overflow-hidden rounded-lg text-left"
    >
      <div className="pointer-events-none select-none blur-sm">{children}</div>
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-bg-sunken/70 text-center font-dm-mono text-xs uppercase tracking-wider text-text-secondary">
        <span>This chapter is not unlocked yet · click to reveal</span>
        {unlockLabel && (
          <span className="text-[0.625rem] normal-case tracking-normal text-text-tertiary">
            Unlocks {unlockLabel}
          </span>
        )}
      </span>
    </button>
  )
}
