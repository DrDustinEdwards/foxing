import { cn } from '@/lib/cn'

interface Props {
  size?: number
  className?: string
}

/**
 * Foxing brand mark. Rounded-square auburn tile with a simplified fox face:
 * two ears with amber inner accents, a paler muzzle, and small eyes. Uses
 * design tokens via CSS custom properties so light/dark themes match.
 */
export function FoxMark({ size = 28, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      <rect
        x="0"
        y="0"
        width="32"
        height="32"
        rx="7"
        fill="var(--brand-ui)"
      />
      {/* Left ear */}
      <path
        d="M5 9 L11 5 L11.5 13 Z"
        fill="var(--brand-ui)"
        stroke="var(--text-on-brand)"
        strokeWidth="0.5"
        opacity="0.95"
      />
      <path
        d="M7 9.4 L10.2 7 L10.5 11.5 Z"
        fill="var(--brand-secondary)"
      />
      {/* Right ear */}
      <path
        d="M27 9 L21 5 L20.5 13 Z"
        fill="var(--brand-ui)"
        stroke="var(--text-on-brand)"
        strokeWidth="0.5"
        opacity="0.95"
      />
      <path
        d="M25 9.4 L21.8 7 L21.5 11.5 Z"
        fill="var(--brand-secondary)"
      />
      {/* Face: rounded triangle pointing down */}
      <path
        d="M6 11 Q6 22 16 26 Q26 22 26 11 Q21 10 16 10 Q11 10 6 11 Z"
        fill="var(--brand-ui)"
        stroke="var(--text-on-brand)"
        strokeWidth="0.5"
      />
      {/* Muzzle */}
      <path
        d="M11 18 Q16 23 21 18 Q21 21 16 24 Q11 21 11 18 Z"
        fill="var(--brand-subtle)"
        opacity="0.85"
      />
      {/* Eyes */}
      <circle cx="12.5" cy="15.5" r="1.2" fill="var(--text-on-brand)" />
      <circle cx="19.5" cy="15.5" r="1.2" fill="var(--text-on-brand)" />
      {/* Nose */}
      <circle cx="16" cy="19.5" r="0.9" fill="var(--text-on-brand)" />
    </svg>
  )
}
