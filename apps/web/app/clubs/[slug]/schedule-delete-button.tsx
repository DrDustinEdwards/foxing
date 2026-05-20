'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { deleteScheduleEntry } from './actions'

export function ScheduleDeleteButton({
  scheduleId,
  clubId,
}: {
  scheduleId: string
  clubId: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        if (!confirm('Remove this schedule entry?')) return
        setPending(true)
        const fd = new FormData()
        fd.set('schedule_id', scheduleId)
        fd.set('club_id', clubId)
        await deleteScheduleEntry(fd)
        setPending(false)
        router.refresh()
      }}
      className="font-dm-mono text-xs text-text-tertiary hover:text-error disabled:opacity-50"
    >
      {pending ? 'Removing...' : 'Remove'}
    </button>
  )
}
