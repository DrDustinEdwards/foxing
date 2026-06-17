'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updateScheduleEntry } from './actions'
import { ScheduleDeleteButton } from './schedule-delete-button'

// ISO -> <input type="datetime-local"> value (YYYY-MM-DDTHH:mm, local time).
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`
}

interface Entry {
  id: string
  chapter_name: string
  unlock_date: string
}

export function ScheduleRow({
  clubId,
  entry,
  canManage,
  statusLabel,
  chipClass,
  unlockDisplay,
}: {
  clubId: string
  entry: Entry
  canManage: boolean
  statusLabel: string
  chipClass: string
  unlockDisplay: string
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const fd = new FormData(e.currentTarget)
    fd.set('schedule_id', entry.id)
    fd.set('club_id', clubId)
    const res = await updateScheduleEntry(fd)
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setEditing(false)
    router.refresh()
  }

  if (editing) {
    return (
      <li className="py-3">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            label="Chapter name"
            name="chapter_name"
            defaultValue={entry.chapter_name}
            maxLength={120}
            required
          />
          <Input
            label="Unlock date and time"
            type="datetime-local"
            name="unlock_date"
            defaultValue={toLocalInput(entry.unlock_date)}
            required
          />
          {error && (
            <p className="font-dm-sans text-xs text-error">{error}</p>
          )}
          <div className="flex gap-2">
            <Button type="submit" variant="primary" size="sm" loading={saving}>
              Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(false)
                setError(null)
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="flex flex-col leading-tight">
        <span className="font-fraunces text-sm text-text-primary">
          {entry.chapter_name}
        </span>
        <span className="font-dm-mono text-xs text-text-tertiary">
          {statusLabel === 'Unlocked' ? 'Unlocked' : 'Unlocks'} {unlockDisplay}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={`rounded-md px-2 py-0.5 font-dm-mono text-[0.625rem] uppercase tracking-wider ${chipClass}`}
        >
          {statusLabel}
        </span>
        {canManage && (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="font-dm-mono text-xs text-text-tertiary hover:text-text-primary"
            >
              Edit
            </button>
            <ScheduleDeleteButton scheduleId={entry.id} clubId={clubId} />
          </>
        )}
      </div>
    </li>
  )
}
