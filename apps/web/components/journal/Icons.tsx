interface IconProps {
  size?: number
  className?: string
}

function strokeProps(size: number) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
}

export function ArrowLeftIcon({ size = 13, className }: IconProps) {
  return (
    <svg {...strokeProps(size)} className={className}>
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  )
}

export function ArrowRightIcon({ size = 13, className }: IconProps) {
  return (
    <svg {...strokeProps(size)} className={className}>
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </svg>
  )
}

export function LinkIcon({ size = 13, className }: IconProps) {
  return (
    <svg {...strokeProps(size)} className={className}>
      <path d="M9 17H7A5 5 0 0 1 7 7h2" />
      <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  )
}

export function CheckIcon({ size = 13, className }: IconProps) {
  return (
    <svg {...strokeProps(size)} className={className}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}
