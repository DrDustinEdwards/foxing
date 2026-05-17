import { type ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  heading: string
  action?: ReactNode
}

export function EmptyState({ icon, heading, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border-subtle bg-bg-surface px-6 py-12 text-center">
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-sunken text-text-tertiary">
          {icon}
        </div>
      )}
      <p className="font-fraunces text-lg text-text-primary">{heading}</p>
      {action && <div>{action}</div>}
    </div>
  )
}
