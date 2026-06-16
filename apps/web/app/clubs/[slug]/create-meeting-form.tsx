'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { ClubMeeting, MeetingType } from '@/lib/club-meetings-types'
import { createClubMeeting, updateClubMeeting } from './actions'

// Format an ISO timestamp for a <input type="datetime-local"> value
// (YYYY-MM-DDTHH:mm in the browser's local time). Empty for null/invalid.
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`
}

/**
 * Shared create/edit form. Pass `meeting` to edit (submits updateClubMeeting),
 * omit it to create (submits createClubMeeting). The location input switches
 * name by meeting type (location_url for virtual, location_address otherwise),
 * keyed so its default value follows the selected type.
 */
export function MeetingForm({
  clubId,
  meeting,
  defaultCity,
  defaultState,
  onDone,
  onCancel,
}: {
  clubId: string
  meeting?: ClubMeeting
  defaultCity: string | null
  defaultState: string | null
  onDone: () => void
  onCancel: () => void
}) {
  const router = useRouter()
  const isEdit = Boolean(meeting)
  const [meetingType, setMeetingType] = useState<MeetingType>(
    meeting?.meeting_type ?? 'in_person',
  )
  const [isRecurring, setIsRecurring] = useState<boolean>(
    meeting?.is_recurring ?? false,
  )
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
    if (meeting) fd.set('meeting_id', meeting.id)
    const res = meeting
      ? await updateClubMeeting(fd)
      : await createClubMeeting(fd)
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    onDone()
    router.refresh()
  }

  const locationPlaceholder =
    meetingType === 'virtual'
      ? 'Zoom or Meet link'
      : 'Address (e.g., 603 N Lamar Blvd)'
  const locationDefault =
    meetingType === 'virtual'
      ? meeting?.location_url ?? ''
      : meeting?.location_address ?? ''

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4"
    >
      <h3 className="font-fraunces text-lg text-text-primary">
        {isEdit ? 'Edit meeting' : 'New meeting'}
      </h3>
      <Input
        label="Title"
        name="title"
        maxLength={120}
        defaultValue={meeting?.title ?? ''}
        required
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="Date and time"
          type="datetime-local"
          name="meeting_date"
          defaultValue={toLocalInput(meeting?.meeting_date ?? null)}
          required
        />
        <Input
          label="End time (optional)"
          type="datetime-local"
          name="end_date"
          defaultValue={toLocalInput(meeting?.end_date ?? null)}
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
              {t === 'in_person'
                ? 'In person'
                : t === 'virtual'
                  ? 'Virtual'
                  : 'Hybrid'}
            </label>
          ))}
        </div>
      </fieldset>
      <Input
        label="Location name (optional)"
        name="location_name"
        defaultValue={meeting?.location_name ?? ''}
      />
      <Input
        key={meetingType}
        label={meetingType === 'virtual' ? 'Meeting link' : 'Address'}
        name={meetingType === 'virtual' ? 'location_url' : 'location_address'}
        placeholder={locationPlaceholder}
        defaultValue={locationDefault}
      />
      {(meetingType === 'virtual' || meetingType === 'hybrid') && (
        <p className="-mt-1 font-dm-mono text-xs text-text-tertiary">
          Paste a Zoom, Meet, or other video call link.
        </p>
      )}
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
        defaultValue={meeting?.book_id ?? ''}
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
          defaultValue={meeting?.description ?? ''}
          className="rounded-md border border-border-interactive bg-bg-surface px-3 py-2 font-source-serif-4 text-sm text-text-primary"
        />
      </div>
      <Input
        label="Limit attendance (optional)"
        name="rsvp_limit"
        type="number"
        min={1}
        defaultValue={meeting?.rsvp_limit ?? ''}
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
          <Select
            name="recurrence_rule"
            defaultValue={meeting?.recurrence_rule ?? 'WEEKLY'}
            aria-label="Repeat"
            options={[
              { value: 'WEEKLY', label: 'Weekly' },
              { value: 'BIWEEKLY', label: 'Every 2 weeks' },
              { value: 'MONTHLY', label: 'Monthly' },
            ]}
          />
        </label>
      )}
      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" loading={saving}>
          {isEdit ? 'Save changes' : 'Schedule'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setError(null)
            onCancel()
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}

interface Props {
  clubId: string
  defaultCity: string | null
  defaultState: string | null
}

export function CreateMeetingForm({ clubId, defaultCity, defaultState }: Props) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Schedule a meeting
      </Button>
    )
  }

  return (
    <MeetingForm
      clubId={clubId}
      defaultCity={defaultCity}
      defaultState={defaultState}
      onDone={() => setOpen(false)}
      onCancel={() => setOpen(false)}
    />
  )
}
