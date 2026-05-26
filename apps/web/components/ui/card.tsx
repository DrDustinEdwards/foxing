import Link from 'next/link'
import { cn } from '@/lib/cn'

/**
 * One Card primitive that encodes Foxing's two card interaction patterns.
 *
 * - `content` (default): border-only hover. The container stays still and
 *   the title color shifts to brand-text via the parent `group` class.
 *   Used for text-first cards (journal posts, lists, articles).
 * - `entity`: shadow lift on hover. Border and title stay static. Used for
 *   object cards that represent a person or group (people, reading clubs).
 *
 * BookCard intentionally does not use this primitive: its cover-image
 * translate + scale hover is correct for that context.
 */

type CardVariant = 'content' | 'entity'

interface CardProps {
  variant?: CardVariant
  href?: string
  className?: string
  children: React.ReactNode
}

const variantClass: Record<CardVariant, string> = {
  content:
    'border-border-subtle bg-bg-surface transition-colors duration-150 hover:border-border-interactive group',
  entity:
    'border-border-subtle bg-bg-surface shadow-sm transition-shadow duration-150 hover:shadow-md',
}

export function Card({
  variant = 'content',
  href,
  className,
  children,
}: CardProps) {
  const base = cn(
    'rounded-lg border flex flex-col',
    variantClass[variant],
    className,
  )
  if (href) {
    return (
      <Link href={href} className={cn(base, 'no-underline h-full')}>
        {children}
      </Link>
    )
  }
  return <div className={base}>{children}</div>
}

interface CardSubProps {
  className?: string
  children: React.ReactNode
}

export function CardLabel({ className, children }: CardSubProps) {
  return (
    <p
      className={cn(
        'font-dm-mono text-[0.6875rem] uppercase tracking-[0.06em] text-text-tertiary',
        className,
      )}
    >
      {children}
    </p>
  )
}

export function CardTitle({ className, children }: CardSubProps) {
  return (
    <p
      className={cn(
        'font-fraunces text-base leading-snug text-text-primary',
        'group-hover:text-brand-text transition-colors duration-150',
        className,
      )}
    >
      {children}
    </p>
  )
}

export function CardBody({ className, children }: CardSubProps) {
  return (
    <p
      className={cn(
        'font-source-serif-4 text-sm text-text-secondary',
        className,
      )}
    >
      {children}
    </p>
  )
}

export function CardMeta({ className, children }: CardSubProps) {
  return (
    <p
      className={cn(
        'font-dm-mono text-[0.6875rem] text-text-tertiary',
        className,
      )}
    >
      {children}
    </p>
  )
}
