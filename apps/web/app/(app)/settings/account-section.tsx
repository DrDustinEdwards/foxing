'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updateProfile } from './actions'

interface Props {
  initial: {
    display_name: string
    username: string
    bio: string
  }
}

export function AccountSection({ initial }: Props) {
  const [displayName, setDisplayName] = useState(initial.display_name)
  const [username, setUsername] = useState(initial.username)
  const [bio, setBio] = useState(initial.bio)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<
    'display_name' | 'username' | 'bio' | null
  >(null)
  const [saved, setSaved] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setFieldError(null)
    setSaved(false)
    setSaving(true)
    const fd = new FormData()
    fd.set('display_name', displayName)
    fd.set('username', username)
    fd.set('bio', bio)
    const res = await updateProfile(fd)
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      setFieldError(res.field ?? null)
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Display name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        maxLength={60}
        required
        error={fieldError === 'display_name' ? error ?? undefined : undefined}
      />
      <Input
        label="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        hint="3 to 30 characters, letters/numbers/underscore."
        required
        error={fieldError === 'username' ? error ?? undefined : undefined}
      />
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="bio"
          className="font-dm-sans text-sm text-text-secondary"
        >
          Bio
        </label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={200}
          rows={3}
          className="rounded-md border border-border-interactive bg-bg-surface px-3 py-2 font-source-serif-4 text-sm text-text-primary"
          placeholder="A line about what you read."
        />
        <span className="font-dm-mono text-xs text-text-tertiary">
          {bio.length} / 200
        </span>
        {fieldError === 'bio' && error && (
          <span className="font-dm-sans text-sm text-error">{error}</span>
        )}
      </div>
      {error && !fieldError && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" loading={saving}>
          Save changes
        </Button>
        {saved && (
          <span className="font-dm-mono text-xs text-success">Saved</span>
        )}
      </div>
    </form>
  )
}
