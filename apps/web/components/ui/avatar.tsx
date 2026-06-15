import Image from 'next/image'
import { cn } from '@/lib/cn'

type Size = 'sm' | 'md' | 'lg'

interface AvatarProps {
  src: string | null | undefined
  name: string
  size?: Size
  className?: string
}

const sizeMap: Record<Size, { px: number; cls: string; text: string }> = {
  sm: { px: 24, cls: 'h-6 w-6', text: 'text-xs' },
  md: { px: 40, cls: 'h-10 w-10', text: 'text-sm' },
  lg: { px: 80, cls: 'h-20 w-20', text: 'text-2xl' },
}

function initials(name: string): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  const dims = sizeMap[size]
  if (src) {
    return (
      <div
        className={cn(
          'relative overflow-hidden rounded-full bg-bg-sunken',
          dims.cls,
          className,
        )}
      >
        <Image
          src={src}
          alt={name}
          width={dims.px}
          height={dims.px}
          className="h-full w-full object-cover"
        />
      </div>
    )
  }
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-brand-subtle font-dm-sans font-medium text-brand-subtle-text',
        dims.cls,
        dims.text,
        className,
      )}
      aria-label={name}
    >
      {initials(name)}
    </div>
  )
}
