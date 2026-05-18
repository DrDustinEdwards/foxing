/**
 * Inline SVG icons used across pages. Each component accepts size/className
 * and uses currentColor so it tracks text color tokens automatically.
 */

interface IconProps {
  size?: number
  className?: string
}

function baseProps(size = 24, className?: string) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    className,
  }
}

export function BookOpenIcon({ size, className }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M2 4.5h7a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5H2z" />
      <path d="M22 4.5h-7a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5H22z" />
    </svg>
  )
}

export function ChatIcon({ size, className }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" />
    </svg>
  )
}

export function CompassIcon({ size, className }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  )
}

export function SearchIcon({ size, className }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

export function ChevronDownIcon({ size, className }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

export function ChevronRightIcon({ size, className }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

export function ShareIcon({ size, className }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  )
}

export function QuoteIcon({ size, className }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M3 21c3-2 4-4 4-9V7h6v6h-4c0 4-1 6-3 8z" />
      <path d="M14 21c3-2 4-4 4-9V7h6v6h-4c0 4-1 6-3 8z" />
    </svg>
  )
}

export function HouseIcon({ size, className }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M3 9.5L12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z" />
    </svg>
  )
}

export function UsersIcon({ size, className }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

export function UsersThreeIcon({ size, className }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <circle cx="6" cy="8" r="3" />
      <circle cx="18" cy="8" r="3" />
      <circle cx="12" cy="10" r="3" />
      <path d="M2 19c0-2 2-4 4-4s4 2 4 4" />
      <path d="M14 19c0-2 2-4 4-4s4 2 4 4" />
      <path d="M8 21c0-2 2-4 4-4s4 2 4 4" />
    </svg>
  )
}

export function FlagIcon({ size, className }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  )
}

export function BellIcon({ size, className }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

export function ChartBarIcon({ size, className }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <line x1="3" y1="20" x2="21" y2="20" />
      <line x1="6" y1="20" x2="6" y2="10" />
      <line x1="11" y1="20" x2="11" y2="4" />
      <line x1="16" y1="20" x2="16" y2="13" />
    </svg>
  )
}

export function PencilIcon({ size, className }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  )
}
