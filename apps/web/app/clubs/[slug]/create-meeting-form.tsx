'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClubMeeting } from './actions'

interface Props {
  clubId: string
  defaultCity: string | null
  defaultState: string | null
}

export function CreateMeetingForm({ clubId, defaultCity, defaultState }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [meetingType, setMeetingType] = useState<
    'in_person' | 'virtual' | 'hybrid'
  >('in_person')
  const [isRecurring, setIsRecurring] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const fd = new FormData(e.currentTarget)
    fd.set('club_id', clubId)
    fd.set('meeting_type', meetingType)
    if (isRecurring) fd.set('is_recurring', 'on')
    const res = await createClubMeeting(fd)
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setOpen(false)
    setMeetingType('in_person')
    setIsRecurring(false)
    router.refresh()
  }

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Schedule a meeting
      </Button>
    )
  }

  const locationPlaceholder =
    meetingType === 'virtual'
      ? 'Zoom or Meet link'
      : 'Address (e.g., 603 N Lamar Blvd)'

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4"
    >
      <h3 className="font-fraunces text-lg text-text-primary">New meeting</h3>
      <Input label="Title" name="title" maxLength={120} required />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="Date and time"
          type="datetime-local"
          name="meeting_date"
          required
        />
        <Input
          label="End time (optional)"
          type="datetime-local"
          name="end_date"
        />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="font-dm-sans text-sm text-text-secondary">
          Meeting type
        </legend>
        <div className="flex flex-wrap gap-3 font-dm-sans text-sm text-text-secondary">
          {(['in_person', 'virtual', 'hybrid'] as const).map((t) => (
            <label key={t} className="flex items-center gap-2">
              <input
                type="radio"
                name="_meeting_type"
                value={t}
                checked={meetingType === t}
                onChange={() => setMeetingType(t)}
              />
              {t === 'in_person' ? 'In person' : t === 'virtual' ? 'Virtual' : 'Hybrid'}
            </label>
          ))}
        </div>
      </fieldset>
      <Input label="Location name (optional)" name="location_name" />
      <Input
        label={meetingType === 'virtual' ? 'Meeting link' : 'Address'}
        name={meetingType === 'virtual' ? 'location_url' : 'location_address'}
        placeholder={locationPlaceholder}
      />
      <Input
        label="City (optional)"
        name="event_city"
        defaultValue={defaultCity ?? ''}
      />
      <Input
        label="State (optional)"
        name="event_state"
        defaultValue={defaultState ?? ''}
        maxLength={2}
      />
      <Input
        label="Linked book ID (optional)"
        name="book_id"
        hint="Paste a book UUID to link this meeting to a book."
      />
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="meeting-description"
          className="font-dm-sans text-sm text-text-secondary"
        >
          Description (optional)
        </label>
        <textarea
          id="meeting-description"
          name="description"
          maxLength={2000}
          rows={3}
          className="rounded-md border border-border-interactive bg-bg-surface px-3 py-2 font-source-serif-4 text-sm text-text-primary"
        />
      </div>
      <Input
        label="Limit attendance (optional)"
        name="rsvp_limit"
        type="number"
        min={1}
      />
      <label className="flex items-center gap-2 font-dm-sans text-sm text-text-secondary">
        <input
          type="checkbox"
          checked={isRecurring}
          onChange={(e) => setIsRecurring(e.target.checked)}
        />
        Recurring meeting
      </label>
      {isRecurring && (
        <label className="flex items-center gap-2 font-dm-sans text-sm text-text-secondary">
          <span>Repeat</span>
          <select
            name="recurrence_rule"
            defaultValue="WEEKLY"
            className="rounded-md border border-border-default bg-bg-surface px-2 py-1 font-dm-sans text-sm text-text-primary"
          >
            <option value="WEEKLY">Weekly</option>
            <option value="BIWEEKLY">Every 2 weeks</option>
            <option value="MONTHLY">Monthly</option>
          </select>
        </label>
      )}
      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" loading={saving}>
          Schedule
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setOpen(false)
            setError(null)
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
