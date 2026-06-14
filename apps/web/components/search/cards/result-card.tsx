import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Shape = 'cover' | 'avatar' | 'square'

interface ResultCardProps {
  href: string
  title: string
  subtitle?: string | null
  imageUrl?: string | null
  /** Fallback glyph when there is no image. */
  icon?: ReactNode
  shape?: Shape
}

const shapeCls: Record<Shape, string> = {
  cover: 'h-16 w-11 rounded',
  avatar: 'h-11 w-11 rounded-full',
  square: 'h-11 w-11 rounded-md',
}

/**
 * Generic search-result row used by the stub entity cards (author/list/quote/
 * journal/pick) and anywhere a uniform result row is needed. Books, people and
 * clubs use their dedicated cards via <SearchResultItem>.
 */
export function ResultCard({
  href,
  title,
  subtitle,
  imageUrl,
  icon,
  shape = 'square',
}: ResultCardProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-border-subtle bg-bg-surface p-3 transition-colors hover:border-border-interactive"
    >
      <div
        className={cn(
          'relative flex shrink-0 items-center justify-center overflow-hidden bg-bg-sunken text-text-tertiary',
          shapeCls[shape],
        )}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            fill
            sizes="44px"
            className="object-cover"
          />
        ) : (
          icon
        )}
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-fraunces text-sm text-text-primary">
          {title}
        </span>
        {subtitle && (
          <span className="truncate font-dm-sans text-xs text-text-tertiary">
            {subtitle}
          </span>
        )}
      </div>
    </Link>
  )
}
