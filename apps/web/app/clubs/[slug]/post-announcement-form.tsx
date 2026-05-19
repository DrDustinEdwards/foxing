'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createAnnouncement } from './actions'

interface Props {
  clubId: string
  defaultCity: string | null
  defaultState: string | null
  canPin: boolean
}

export function PostAnnouncementForm({
  clubId,
  defaultCity,
  defaultState,
  canPin,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isEvent, setIsEvent] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const fd = new FormData(e.currentTarget)
    fd.set('club_id', clubId)
    if (isEvent) fd.set('is_event', 'on')
    const res = await createAnnouncement(fd)
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setOpen(false)
    setIsEvent(false)
    router.refresh()
  }

  if (!open) {
    return (
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
      >
        Post announcement
      </Button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4"
    >
      <h3 className="font-fraunces text-lg text-text-primary">
        New announcement
      </h3>
      <Input label="Title" name="title" maxLength={120} required />
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="announcement-body"
          className="font-dm-sans text-sm text-text-secondary"
        >
          Body (optional)
        </label>
        <textarea
          id="announcement-body"
          name="body"
          maxLength={2000}
          rows={4}
          className="rounded-md border border-border-interactive bg-bg-surface px-3 py-2 font-source-serif-4 text-sm text-text-primary"
        />
      </div>

      <label className="flex items-center gap-2 font-dm-sans text-sm text-text-secondary">
        <input
          type="checkbox"
          checked={isEvent}
          onChange={(e) => setIsEvent(e.target.checked)}
        />
        This is an event with a date
      </label>

      {isEvent && (
        <div className="flex flex-col gap-3 rounded-md bg-bg-sunken p-3">
          <Input
            label="Date and time"
            type="datetime-local"
            name="event_date"
            required
          />
          <Input
            label="End time (optional)"
            type="datetime-local"
            name="event_end_date"
          />
          <Input
            label="Location name"
            name="event_location"
            placeholder="BookPeople"
          />
          <Input label="Address (optional)" name="event_address" />
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Input
                label="City"
                name="event_city"
                defaultValue={defaultCity ?? ''}
              />
            </div>
            <Input
              label="State"
              name="event_state"
              maxLength={2}
              defaultValue={defaultState ?? ''}
              hint="2-letter code"
            />
          </div>
          <Input label="ZIP (optional)" name="event_zip" />
        </div>
      )}

      <Input
        label="Linked book ID (optional)"
        name="book_id"
        hint="Paste a book UUID to link this announcement to a book."
      />

      {canPin && (
        <label className="flex items-center gap-2 font-dm-sans text-sm text-text-secondary">
          <input type="checkbox" name="is_pinned" />
          Pin this announcement
        </label>
      )}

      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" size="sm" loading={saving}>
          Post
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setOpen(false)
            setIsEvent(false)
            setError(null)
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
