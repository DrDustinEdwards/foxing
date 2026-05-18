'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/cn'
import { setMastered } from './mastered-action'

interface MasteredToggleProps {
  id: string
  initiallyMastered: boolean
}

export function MasteredToggle({
  id,
  initiallyMastered,
}: MasteredToggleProps) {
  const [mastered, setLocal] = useState(initiallyMastered)
  const [pending, startTransition] = useTransition()

  function toggle() {
    const previous = mastered
    const next = !previous
    setLocal(next)
    startTransition(() => {
      void setMastered({ id, mastered: next }).then((res) => {
        if (!res.ok) setLocal(previous)
      })
    })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={mastered}
      className={cn(
        'rounded-full border px-3 py-0.5 font-dm-sans text-xs transition-colors',
        mastered
          ? 'border-success bg-success-bg text-success'
          : 'border-border-subtle bg-bg-surface text-text-tertiary hover:bg-bg-hover',
      )}
    >
      {mastered ? 'Mastered' : 'Mark mastered'}
    </button>
  )
}
