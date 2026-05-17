'use client'

import { useState } from 'react'
import { cn } from '@/lib/cn'

interface StarRatingProps {
  value: number | null
  onChange?: (value: number) => void
  size?: 'sm' | 'md' | 'lg'
  readOnly?: boolean
  label?: string
}

const sizeMap = {
  sm: { star: 14, gap: 'gap-0.5' },
  md: { star: 20, gap: 'gap-1' },
  lg: { star: 28, gap: 'gap-1.5' },
} as const

export function StarRating({
  value,
  onChange,
  size = 'md',
  readOnly = false,
  label,
}: StarRatingProps) {
  const [hover, setHover] = useState<number | null>(null)
  const displayed = hover ?? value ?? 0
  const dims = sizeMap[size]
  const isInteractive = !readOnly && onChange !== undefined

  function fillFor(starIndex: number): number {
    const position = starIndex + 1
    if (displayed >= position) return 1
    if (displayed >= position - 0.5) return 0.5
    return 0
  }

  if (!isInteractive) {
    return (
      <div
        className={cn('inline-flex items-center', dims.gap)}
        aria-label={
          label ?? (value === null ? 'no rating' : `${value} out of 5 stars`)
        }
      >
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} fill={fillFor(i)} size={dims.star} />
        ))}
      </div>
    )
  }

  return (
    <div
      className={cn('inline-flex items-center', dims.gap)}
      role="radiogroup"
      aria-label={label ?? 'rating'}
      onMouseLeave={() => setHover(null)}
    >
      {Array.from({ length: 5 }, (_, i) => {
        const position = i + 1
        return (
          <div key={i} className="relative inline-flex">
            <button
              type="button"
              className="absolute inset-0 left-0 z-10 w-1/2"
              aria-label={`${position - 0.5} stars`}
              onMouseEnter={() => setHover(position - 0.5)}
              onClick={() => onChange?.(position - 0.5)}
            />
            <button
              type="button"
              className="absolute inset-0 left-1/2 z-10 w-1/2"
              aria-label={`${position} stars`}
              onMouseEnter={() => setHover(position)}
              onClick={() => onChange?.(position)}
            />
            <Star fill={fillFor(i)} size={dims.star} />
          </div>
        )
      })}
    </div>
  )
}

function Star({ fill, size }: { fill: number; size: number }) {
  const gradId = `star-grad-${fill}-${size}`
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="shrink-0"
    >
      <defs>
        <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">
          <stop offset={`${fill * 100}%`} stopColor="var(--brand-secondary)" />
          <stop offset={`${fill * 100}%`} stopColor="var(--border-default)" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.5l2.95 6.27 6.55.75-4.85 4.48 1.36 6.5L12 17.27 5.99 20.5l1.36-6.5L2.5 9.52l6.55-.75L12 2.5z"
        fill={`url(#${gradId})`}
        stroke="var(--border-default)"
        strokeWidth="0.5"
      />
    </svg>
  )
}
