'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toggleHighlightLike } from '@/app/quotes/actions'
import { cn } from '@/lib/cn'

interface LikeHighlightButtonProps {
  highlightId: string
  initialLiked: boolean
  initialCount: number
  userId: string | null
  className?: string
}

export function LikeHighlightButton({
  highlightId,
  initialLiked,
  initialCount,
  userId,
  className,
}: LikeHighlightButtonProps) {
  const router = useRouter()
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [isPending, startTransition] = useTransition()

  function onClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (!userId) {
      router.push('/sign-in')
      return
    }
    const previousLiked = liked
    const previousCount = count
    const nextLiked = !previousLiked
    const nextCount = Math.max(0, previousCount + (nextLiked ? 1 : -1))
    setLiked(nextLiked)
    setCount(nextCount)
    startTransition(() => {
      void toggleHighlightLike({ highlightId }).then((result) => {
        if (!result.ok) {
          setLiked(previousLiked)
          setCount(previousCount)
        } else {
          setLiked(result.liked)
          setCount(result.likeCount)
        }
      })
    })
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      aria-pressed={liked}
      aria-label={liked ? 'Unlike highlight' : 'Like highlight'}
      className={cn(
        'inline-flex items-center gap-1 font-dm-sans text-xs transition-colors',
        liked
          ? 'text-brand-text'
          : 'text-text-tertiary hover:text-text-primary',
        className,
      )}
    >
      <HeartIcon filled={liked} />
      {count > 0 && <span>{count}</span>}
    </button>
  )
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}
