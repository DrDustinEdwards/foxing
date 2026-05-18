import { cn } from '@/lib/cn'

interface BookCoverPlaceholderProps {
  title: string
  author: string
  className?: string
  textClassName?: string
}

function getInitials(author: string): string {
  return author
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('')
}

export function BookCoverPlaceholder({
  title,
  author,
  className,
  textClassName,
}: BookCoverPlaceholderProps) {
  const initials = getInitials(author) || '?'
  return (
    <div
      aria-label={`${title} by ${author}`}
      className={cn(
        'absolute inset-0 flex items-center justify-center bg-bg-sunken',
        className,
      )}
    >
      <span
        className={cn(
          'font-fraunces text-2xl text-text-tertiary',
          textClassName,
        )}
      >
        {initials}
      </span>
    </div>
  )
}
