import type { ReactNode } from 'react'

/**
 * The single header for every club workspace pane. One canonical style across
 * Overview/Discussions/Meetings/Polls/Schedule/Members/Moderation/Settings:
 * font-fraunces text-xl, title left, optional primary action right, consistent
 * bottom spacing, and no top margin (the pane already provides vertical offset).
 */
export function ClubSectionHeader({
  title,
  action,
}: {
  title: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-fraunces text-xl text-text-primary">{title}</h2>
      {action}
    </div>
  )
}
