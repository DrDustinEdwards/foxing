import { type ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'brand' | 'success' | 'warning' | 'error' | 'info' | 'neutral'

interface BadgeProps {
  variant?: Variant
  children: ReactNode
  className?: string
}

const variantStyles: Record<Variant, string> = {
  brand: 'bg-brand-subtle text-brand-subtle-text',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  error: 'bg-error-bg text-error',
  info: 'bg-info-bg text-info',
  neutral: 'bg-bg-sunken text-text-secondary',
}

export function Badge({ variant = 'neutral', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 font-dm-sans text-xs font-medium',
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
