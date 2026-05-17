'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { StarRating } from '@/components/ui/star-rating'
import { formatRelativeDate } from '@foxing/utils'
import type { Review } from '@/types/database'

interface ReviewCardProps {
  review: Review
  likeCount?: number
  replyCount?: number
  onLike?: () => void
}

const TRUNCATE_AT = 200

export function ReviewCard({
  review,
  likeCount = 0,
  replyCount = 0,
  onLike,
}: ReviewCardProps) {
  const [expanded, setExpanded] = useState(false)
  const isLong = review.review.length > TRUNCATE_AT
  const displayed = expanded || !isLong
    ? review.review
    : `${review.review.slice(0, TRUNCATE_AT).trimEnd()}...`

  const author = review.author

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4">
      <header className="flex items-center gap-3">
        <Avatar
          src={author?.avatar_url}
          name={author?.display_name ?? 'Reader'}
          size="md"
        />
        <div className="flex flex-col">
          <div className="flex items-baseline gap-2">
            {author ? (
              <Link
                href={`/u/${author.username}`}
                className="font-dm-sans text-sm font-medium text-text-primary hover:text-brand-text"
              >
                {author.display_name}
              </Link>
            ) : (
              <span className="font-dm-sans text-sm font-medium text-text-primary">
                Reader
              </span>
            )}
            {author && (
              <span className="font-dm-sans text-xs text-text-tertiary">
                @{author.username}
              </span>
            )}
          </div>
          <time className="font-dm-sans text-xs text-text-tertiary">
            {formatRelativeDate(review.created_at)}
          </time>
        </div>
      </header>

      <StarRating value={review.rating_half} size="sm" readOnly />

      <p className="font-source-serif-4 text-sm text-text-primary">
        {displayed}
        {isLong && !expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="ml-1 font-dm-sans text-xs font-medium text-brand-text hover:underline"
          >
            Read more
          </button>
        )}
      </p>

      {(review.mood_tags?.length || review.pacing) && (
        <div className="flex flex-wrap gap-1.5">
          {review.mood_tags?.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="brand">
              {tag}
            </Badge>
          ))}
          {review.pacing && <Badge variant="neutral">{review.pacing}</Badge>}
        </div>
      )}

      <footer className="flex items-center gap-4 border-t border-border-subtle pt-3 font-dm-sans text-xs text-text-tertiary">
        <button
          type="button"
          onClick={onLike}
          className="inline-flex items-center gap-1 hover:text-text-primary"
        >
          <HeartIcon /> {likeCount}
        </button>
        <span className="inline-flex items-center gap-1">
          <ReplyIcon /> {replyCount}
        </span>
      </footer>
    </article>
  )
}

function HeartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function ReplyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}
