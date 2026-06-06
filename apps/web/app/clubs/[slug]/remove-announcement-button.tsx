'use client'

import { ConfirmActionButton } from '@/components/ui/confirm-action-button'
import { removeAnnouncement } from './actions'

export function RemoveAnnouncementButton({
  id,
  clubId,
}: {
  id: string
  clubId: string
}) {
  return (
    <ConfirmActionButton
      action={removeAnnouncement}
      fields={{ id, club_id: clubId }}
      confirmText="Remove this announcement?"
      label="Remove"
      pendingLabel="Removing..."
      className="font-dm-sans text-xs text-text-tertiary hover:text-error disabled:opacity-50"
    />
  )
}
