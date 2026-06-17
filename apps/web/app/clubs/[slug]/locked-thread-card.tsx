'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { ReactNode } from 'react'

/**
 * Spoiler gate for a discussion thread whose chapter is not yet unlocked.
 * Blurs the thread card until the reader clicks to reveal (the same opt-in
 * blur-until-click pattern as spoiler-tagged posts), then exposes the link.
 */
export function LockedThreadCard({
  href,
  unlockLabel,
  children,
}: {
  href: string
  unlockLabel: string | null
  children: ReactNode
}) {
  const [revealed, setRevealed] = useState(false)

  if (!revealed) {
    return (
      <button
        type="button"
        onClick={() => setRevealed(true)}
        aria-label="Reveal locked chapter thread"
        className="relative block w-full overflow-hidden rounded-lg border border-border-subtle bg-bg-surface p-4 text-left"
      >
        <div className="pointer-events-none select-none blur-sm">{children}</div>
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-bg-sunken/70 text-center font-dm-mono text-xs uppercase tracking-wider text-text-secondary">
          <span>Locked chapter · click to reveal</span>
          {unlockLabel && (
            <span className="text-[0.625rem] normal-case tracking-normal text-text-tertiary">
              Unlocks {unlockLabel}
            </span>
          )}
        </span>
      </button>
    )
  }

  return (
    <Link
      href={href}
      className="block rounded-lg border border-border-subtle bg-bg-surface p-4 transition-colors hover:border-border-interactive"
    >
      {children}
    </Link>
  )
}
