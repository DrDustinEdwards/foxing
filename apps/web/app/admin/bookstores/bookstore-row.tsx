'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toggleVerification, updateBookstoreProfile } from './actions'

interface BookstoreView {
  id: string
  name: string
  slug: string | null
  bookstore_address: string | null
  bookstore_city: string | null
  bookstore_state: string | null
  bookstore_zip: string | null
  bookstore_website: string | null
  bookstore_phone: string | null
  bookstore_hours: Record<string, string> | null
  club_type: 'reading' | 'bookstore' | null
  is_verified: boolean | null
  member_count: number
  event_count: number
}

const DAYS = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
] as const

export function BookstoreRow({ store }: { store: BookstoreView }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleVerify(verified: boolean) {
    setPending(true)
    setError(null)
    const fd = new FormData()
    fd.set('club_id', store.id)
    fd.set('verified', verified ? 'true' : 'false')
    const res = await toggleVerification(fd)
    setPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    router.refresh()
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const fd = new FormData(e.currentTarget)
    fd.set('club_id', store.id)
    const res = await updateBookstoreProfile(fd)
    setPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setEditing(false)
    router.refresh()
  }

  const location = [store.bookstore_city, store.bookstore_state]
    .filter(Boolean)
    .join(', ')

  return (
    <article className="rounded-lg border border-border-subtle bg-bg-surface p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-fraunces text-lg text-text-primary">
            {store.name}
          </p>
          <p className="font-dm-mono text-xs text-text-tertiary">
            {store.slug ?? '(no slug)'} · {location || 'no location'}
          </p>
          <p className="mt-1 font-dm-sans text-xs text-text-tertiary">
            {store.member_count} members · {store.event_count} events posted
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {store.is_verified ? (
            <Badge variant="success">Verified</Badge>
          ) : (
            <Badge variant="neutral">Unverified</Badge>
          )}
          <Button
            variant={store.is_verified ? 'ghost' : 'primary'}
            size="sm"
            onClick={() => handleVerify(!store.is_verified)}
            loading={pending}
          >
            {store.is_verified ? 'Unverify' : 'Verify'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? 'Close' : 'Edit profile'}
          </Button>
        </div>
      </header>

      {editing && (
        <form
          onSubmit={handleSave}
          className="mt-4 grid grid-cols-1 gap-3 rounded-md bg-bg-sunken p-4 md:grid-cols-2"
        >
          <div className="md:col-span-2">
            <Input
              label="Bookstore name"
              name="name"
              defaultValue={store.name}
              required
            />
          </div>
          <Input
            label="Address"
            name="bookstore_address"
            defaultValue={store.bookstore_address ?? ''}
          />
          <Input
            label="City"
            name="bookstore_city"
            defaultValue={store.bookstore_city ?? ''}
          />
          <Input
            label="State (2-letter)"
            name="bookstore_state"
            defaultValue={store.bookstore_state ?? ''}
            maxLength={2}
          />
          <Input
            label="ZIP"
            name="bookstore_zip"
            defaultValue={store.bookstore_zip ?? ''}
          />
          <Input
            label="Website"
            name="bookstore_website"
            defaultValue={store.bookstore_website ?? ''}
            type="url"
          />
          <Input
            label="Phone"
            name="bookstore_phone"
            defaultValue={store.bookstore_phone ?? ''}
          />
          <div className="md:col-span-2">
            <p className="mb-2 font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
              Hours (free text per day)
            </p>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {DAYS.map((d) => (
                <Input
                  key={d.key}
                  label={d.label}
                  name={`hours_${d.key}`}
                  defaultValue={store.bookstore_hours?.[d.key] ?? ''}
                  placeholder="9-6"
                />
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="flex items-center gap-2 font-dm-sans text-sm text-text-secondary">
              <span>Type</span>
              <select
                name="club_type"
                defaultValue={store.club_type ?? 'bookstore'}
                className="rounded-md border border-border-default bg-bg-surface px-2 py-1.5 font-dm-sans text-sm text-text-primary"
              >
                <option value="bookstore">bookstore</option>
                <option value="reading">reading</option>
              </select>
            </label>
          </div>
          {error && (
            <p className="md:col-span-2 rounded-md bg-error-bg px-3 py-2 text-sm text-error">
              {error}
            </p>
          )}
          <div className="md:col-span-2 flex gap-2">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={pending}
            >
              Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </article>
  )
}
