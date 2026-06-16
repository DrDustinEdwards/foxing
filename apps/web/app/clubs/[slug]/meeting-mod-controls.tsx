'use client'

import { useState } from 'react'
import type { ClubMeeting } from '@/lib/club-meetings-types'
import { CancelMeetingButton } from './cancel-meeting-button'
import { MeetingForm } from './create-meeting-form'

export function MeetingModControls({
  clubId,
  meeting,
  defaultCity,
  defaultState,
}: {
  clubId: string
  meeting: ClubMeeting
  defaultCity: string | null
  defaultState: string | null
}) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <MeetingForm
        clubId={clubId}
        meeting={meeting}
        defaultCity={defaultCity}
        defaultState={defaultState}
        onDone={() => setEditing(false)}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3 font-dm-mono text-xs text-text-tertiary">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="hover:text-text-primary"
      >
        Edit
      </button>
      <CancelMeetingButton meetingId={meeting.id} clubId={clubId} />
    </div>
  )
}
