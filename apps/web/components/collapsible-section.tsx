'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDownIcon } from '@/components/icons'
import { cn } from '@/lib/cn'

interface CollapsibleSectionProps {
  heading: string
  children: ReactNode
  defaultOpen?: boolean
  rightSlot?: ReactNode
}

export function CollapsibleSection({
  heading,
  children,
  defaultOpen = false,
  rightSlot,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="border-t border-border-subtle py-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex flex-1 items-center justify-between gap-3 text-left"
        >
          <h2 className="font-fraunces text-xl text-text-primary">{heading}</h2>
          <ChevronDownIcon
            size={20}
            className={cn(
              'shrink-0 text-text-tertiary transition-transform',
              open && 'rotate-180',
            )}
          />
        </button>
        {rightSlot && <div className="ml-3">{rightSlot}</div>}
      </div>
      {open && <div className="mt-4">{children}</div>}
    </section>
  )
}
