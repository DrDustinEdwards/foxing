import { cn } from '@/lib/cn'

interface AuthCardProps {
  children: React.ReactNode
  gap?: 4 | 6
  className?: string
}

export function AuthCard({ children, gap = 6, className }: AuthCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border border-border-subtle bg-bg-surface p-6 shadow-sm',
        gap === 4 ? 'gap-4' : 'gap-6',
        className,
      )}
    >
      {children}
    </div>
  )
}
