import Link from 'next/link'
import { cn } from '@/lib/cn'

/**
 * Canonical category/tag pill: brand-subtle wash, mono small caps.
 * Renders a link with the brand fill hover when `href` is given,
 * a static span otherwise.
 */
export function TagPill({
  href,
  className,
  children,
}: {
  href?: string
  className?: string
  children: React.ReactNode
}) {
  const base = cn(
    'self-start rounded-full bg-brand-subtle px-3 py-1 font-dm-mono text-[0.6875rem] uppercase tracking-[0.08em] text-brand-subtle-text',
    className,
  )
  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          base,
          'no-underline transition-colors hover:bg-brand-ui hover:text-text-on-brand',
        )}
      >
        {children}
      </Link>
    )
  }
  return <span className={base}>{children}</span>
}
