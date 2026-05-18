'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  deleteUser,
  sendAdminNotification,
  toggleUserAdmin,
  toggleUserSuspended,
  updateUserTier,
} from './actions'

const TIERS = ['free', 'plus', 'patron'] as const

export function TierSelector({
  userId,
  tier,
}: {
  userId: string
  tier: string
}) {
  const [value, setValue] = useState(tier)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value
    setValue(next)
    setSaved(false)
    setSaving(true)
    const fd = new FormData()
    fd.set('id', userId)
    fd.set('tier', next)
    await updateUserTier(fd)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor="tier"
        className="font-dm-sans text-sm text-text-secondary"
      >
        Subscription tier
      </label>
      <div className="flex items-center gap-3">
        <select
          id="tier"
          value={value}
          onChange={handleChange}
          disabled={saving}
          className="h-10 rounded-md border border-border-interactive bg-bg-surface px-2 font-dm-sans text-sm capitalize text-text-primary"
        >
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {saving && (
          <span className="font-dm-mono text-xs text-text-tertiary">
            Saving
          </span>
        )}
        {saved && !saving && (
          <span className="font-dm-mono text-xs text-success">Saved</span>
        )}
      </div>
    </div>
  )
}

export function AdminToggle({
  userId,
  isAdmin,
}: {
  userId: string
  isAdmin: boolean
}) {
  const [value, setValue] = useState(isAdmin)
  const [saving, setSaving] = useState(false)

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.checked
    setValue(next)
    setSaving(true)
    const fd = new FormData()
    fd.set('id', userId)
    fd.set('next', String(next))
    await toggleUserAdmin(fd)
    setSaving(false)
  }

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor="admin"
        className="flex items-center gap-3 font-dm-sans text-sm text-text-secondary"
      >
        <input
          type="checkbox"
          id="admin"
          checked={value}
          onChange={handleChange}
          disabled={saving}
          className="h-4 w-4 rounded border-border-interactive accent-toggle-on"
        />
        <span>Admin (full access to /admin)</span>
      </label>
    </div>
  )
}

export function SuspendedToggle({
  userId,
  isSuspended,
}: {
  userId: string
  isSuspended: boolean
}) {
  const [value, setValue] = useState(isSuspended)
  const [saving, setSaving] = useState(false)

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.checked
    if (next && !window.confirm('Suspend this account and invalidate all sessions?')) {
      e.target.checked = false
      return
    }
    setValue(next)
    setSaving(true)
    const fd = new FormData()
    fd.set('id', userId)
    fd.set('next', String(next))
    await toggleUserSuspended(fd)
    setSaving(false)
  }

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor="suspended"
        className="flex items-center gap-3 font-dm-sans text-sm text-text-secondary"
      >
        <input
          type="checkbox"
          id="suspended"
          checked={value}
          onChange={handleChange}
          disabled={saving}
          className="h-4 w-4 rounded border-border-interactive accent-toggle-on"
        />
        <span>
          Suspended {value ? '(signed out, cannot sign in)' : ''}
        </span>
      </label>
    </div>
  )
}

export function SendNotificationForm({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('id', userId)
    setError(null)
    setSent(false)
    startTransition(() => {
      void (async () => {
        try {
          await sendAdminNotification(fd)
          setSent(true)
          setOpen(false)
          setTimeout(() => setSent(false), 2000)
        } catch (err) {
          setError(
            err instanceof Error ? err.message : 'Could not send the message.',
          )
        }
      })()
    })
  }

  if (!open) {
    return (
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setOpen(true)}
        >
          Send notification
        </Button>
        {sent && (
          <span className="font-dm-mono text-xs text-success">Sent</span>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Input
        label="Title"
        name="title"
        maxLength={120}
        required
        autoFocus
      />
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="body"
          className="font-dm-sans text-sm text-text-secondary"
        >
          Body
        </label>
        <textarea
          id="body"
          name="body"
          rows={3}
          required
          maxLength={500}
          className="rounded-md border border-border-interactive bg-bg-surface px-3 py-2 font-source-serif-4 text-base text-text-primary"
        />
      </div>
      {error && (
        <p className="font-dm-sans text-sm text-error" role="alert">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" size="sm" loading={pending}>
          Send
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}

export function DeleteUserButton({
  userId,
  username,
}: {
  userId: string
  username: string
}) {
  const [pending, setPending] = useState(false)

  async function handleClick() {
    const confirmText = window.prompt(
      `Type the username "${username}" to confirm permanent deletion.`,
    )
    if (confirmText !== username) return
    setPending(true)
    const fd = new FormData()
    fd.set('id', userId)
    await deleteUser(fd)
  }

  return (
    <Button
      variant="danger"
      size="md"
      onClick={handleClick}
      loading={pending}
    >
      Delete account
    </Button>
  )
}
