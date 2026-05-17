import { type ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface PageWrapperProps {
  children: ReactNode
  className?: string
}

export function PageWrapper({ children, className }: PageWrapperProps) {
  return (
    <div className={cn('mx-auto w-full max-w-page px-6', className)}>
      {children}
    </div>
  )
}
