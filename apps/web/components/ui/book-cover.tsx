import { cn } from '@/lib/cn'

/**
 * Aspect-ratio cover shell with the standard cover hover: shadow-sm
 * lifting to shadow-md via the parent `group`. Children are the cover
 * Image or placeholder plus any overlays (badges, progress bars).
 */
export function BookCover({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'relative aspect-[2/3] w-full overflow-hidden rounded-md bg-bg-sunken shadow-sm transition-shadow group-hover:shadow-md',
        className,
      )}
    >
      {children}
    </div>
  )
}
