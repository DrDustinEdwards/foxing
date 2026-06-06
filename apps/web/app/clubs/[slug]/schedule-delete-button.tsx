'use client'

import { ConfirmActionButton } from '@/components/ui/confirm-action-button'
import { deleteScheduleEntry } from './actions'

export function ScheduleDeleteButton({
  scheduleId,
  clubId,
}: {
  scheduleId: string
  clubId: string
}) {
  return (
    <ConfirmActionButton
      action={deleteScheduleEntry}
      fields={{ schedule_id: scheduleId, club_id: clubId }}
      confirmText="Remove this schedule entry?"
      label="Remove"
      pendingLabel="Removing..."
      className="font-dm-mono text-xs text-text-tertiary hover:text-error disabled:opacity-50"
    />
  )
}
