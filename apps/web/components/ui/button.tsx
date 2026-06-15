import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
  loading?: boolean
}

const variantStyles: Record<Variant, string> = {
  // Saturated auburn primary: subtle resting depth, then BRIGHTEN on hover
  // (never darken to --brand-hover, which read as pressed/disabled). The fill
  // stays --brand-ui so white text contrast is unchanged. No lift/translate --
  // only brightness + shadow change; active keeps the press scale.
  primary:
    'bg-brand-ui text-text-on-amber shadow-sm hover:brightness-[1.08] hover:shadow-md active:brightness-100 active:shadow-none disabled:bg-bg-disabled disabled:text-text-disabled disabled:shadow-none disabled:brightness-100',
  secondary:
    'bg-transparent text-brand-text border border-border-interactive hover:bg-brand-subtle disabled:text-text-disabled disabled:border-border-default',
  ghost:
    'bg-transparent text-text-primary hover:bg-bg-hover disabled:text-text-disabled',
  danger:
    'bg-error text-text-on-brand hover:opacity-90 disabled:opacity-50',
}

const sizeStyles: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-base',
  lg: 'h-12 px-6 text-base',
}

// Pill radius for the standard variants; danger stays rounded-md. Large keeps
// rounded-lg (a full pill reads oversized at that height).
function radiusFor(variant: Variant, size: Size): string {
  if (size === 'lg') return 'rounded-lg'
  return variant === 'danger' ? 'rounded-md' : 'rounded-full'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      loading = false,
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-dm-sans font-medium transition-all duration-150',
          'disabled:cursor-not-allowed',
          'active:scale-[0.97]',
          variantStyles[variant],
          sizeStyles[size],
          radiusFor(variant, size),
          fullWidth && 'w-full',
          className,
        )}
        {...props}
      >
        {loading ? <Spinner /> : children}
      </button>
    )
  },
)

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
      aria-label="loading"
      role="status"
    />
  )
}
