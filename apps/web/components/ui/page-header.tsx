import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * The single top-level page header for main-nav pages (Books, Celebrity Picks,
 * Clubs, Journal, People, and peers). One canonical title style everywhere:
 * font-fraunces text-[2.5rem] leading-tight. Subtitles use one of two variants
 * ("count" or "description"), with consistent top spacing. An optional actions
 * slot sits right-aligned next to the title.
 */
export function PageHeader({
  title,
  subtitle,
  subtitleVariant = 'count',
  actions,
}: {
  title: string
  subtitle?: string
  subtitleVariant?: 'count' | 'description'
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col">
        <h1 className="font-fraunces text-[2.5rem] leading-tight text-text-primary">
          {title}
        </h1>
        {subtitle && (
          <p
            className={cn(
              'mt-3',
              subtitleVariant === 'description'
                ? 'max-w-prose font-source-serif-4 text-base text-text-secondary'
                : 'font-dm-sans text-sm text-text-tertiary',
            )}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions}
    </header>
  )
}
