'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { deleteUser, toggleUserAdmin, updateUserTier } from './actions'

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
          className="h-4 w-4 rounded border-border-interactive"
        />
        <span>Admin (full access to /admin)</span>
      </label>
    </div>
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
