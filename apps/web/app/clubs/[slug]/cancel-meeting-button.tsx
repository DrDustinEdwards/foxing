'use client'

import { ConfirmActionButton } from '@/components/ui/confirm-action-button'
import { cancelClubMeeting } from './actions'

export function CancelMeetingButton({
  meetingId,
  clubId,
}: {
  meetingId: string
  clubId: string
}) {
  return (
    <ConfirmActionButton
      action={cancelClubMeeting}
      fields={{ meeting_id: meetingId, club_id: clubId }}
      confirmText="Cancel this meeting?"
      label="Cancel meeting"
      pendingLabel="Cancelling..."
      className="text-text-tertiary hover:text-error disabled:opacity-50"
    />
  )
}
