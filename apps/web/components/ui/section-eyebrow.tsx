import { cn } from '@/lib/cn'

/**
 * Canonical section eyebrow: mono small caps with wide tracking, tertiary
 * ink. Pass margins via className; pick the heading level via `as`.
 */
export function SectionEyebrow({
  as: Tag = 'p',
  className,
  children,
}: {
  as?: 'h2' | 'h3' | 'p' | 'span'
  className?: string
  children: React.ReactNode
}) {
  return (
    <Tag
      className={cn(
        'font-dm-mono text-[0.6875rem] uppercase tracking-[0.18em] text-text-tertiary',
        className,
      )}
    >
      {children}
    </Tag>
  )
}
