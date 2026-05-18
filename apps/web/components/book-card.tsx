import Image from 'next/image'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { StarRating } from '@/components/ui/star-rating'
import { cn } from '@/lib/cn'

type Size = 'sm' | 'md' | 'lg'

export interface BookCardBook {
  id: string
  slug?: string | null
  title: string
  author: string
  cover_url: string | null
  themes?: string[] | null
  weighted_rating?: number | null
}

interface BookCardProps {
  book: BookCardBook
  size?: Size
  showMood?: boolean
  showRating?: boolean
}

const sizeMap: Record<Size, { wrap: string; cover: { w: number; h: number; cls: string } }> = {
  sm: { wrap: 'w-[100px]', cover: { w: 100, h: 150, cls: 'h-[150px] w-[100px]' } },
  md: { wrap: 'w-[140px]', cover: { w: 140, h: 210, cls: 'h-[210px] w-[140px]' } },
  lg: { wrap: 'w-[180px]', cover: { w: 180, h: 270, cls: 'h-[270px] w-[180px]' } },
}

export function BookCard({
  book,
  size = 'md',
  showMood = true,
  showRating = true,
}: BookCardProps) {
  const dims = sizeMap[size]
  const firstMood = book.themes?.[0]
  return (
    <Link
      href={`/book/${book.slug ?? book.id}`}
      className={cn(
        'group flex flex-col gap-2 transition-transform duration-200 hover:-translate-y-0.5',
        dims.wrap,
      )}
    >
      <div
        className={cn(
          'relative overflow-hidden rounded-md bg-bg-sunken shadow-sm transition-shadow duration-200 group-hover:shadow-md',
          dims.cover.cls,
        )}
      >
        {book.cover_url ? (
          <Image
            src={book.cover_url}
            alt={`Cover of ${book.title}`}
            fill
            sizes={`${dims.cover.w}px`}
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-text-tertiary">
            <BookIcon />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="truncate font-fraunces text-sm text-text-primary">
          {book.title}
        </p>
        <p className="truncate font-dm-sans text-xs text-text-tertiary">
          {book.author}
        </p>
        {showRating && typeof book.weighted_rating === 'number' && (
          <StarRating value={book.weighted_rating} size="sm" readOnly />
        )}
        {showMood && firstMood && (
          <Badge variant="brand" className="mt-1 w-fit">
            {firstMood}
          </Badge>
        )}
      </div>
    </Link>
  )
}

function BookIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </svg>
  )
}
