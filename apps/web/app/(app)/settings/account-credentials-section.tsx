'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { updateUsername } from './actions'

const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$/

interface Props {
  email: string
  username: string
}

type Panel = 'email' | 'username' | 'password' | null

export function AccountCredentialsSection({ email, username }: Props) {
  const [open, setOpen] = useState<Panel>(null)
  const [currentEmail, setCurrentEmail] = useState(email)
  const [currentUsername, setCurrentUsername] = useState(username)

  return (
    <div className="flex flex-col divide-y divide-border-subtle border-y border-border-subtle">
      <Row
        label="Email address"
        value={currentEmail}
        actionLabel={open === 'email' ? 'Cancel' : 'Change email'}
        onAction={() => setOpen(open === 'email' ? null : 'email')}
      >
        {open === 'email' && (
          <ChangeEmailForm
            currentEmail={currentEmail}
            onDone={() => setOpen(null)}
          />
        )}
      </Row>
      <Row
        label="Username"
        value={`@${currentUsername}`}
        actionLabel={open === 'username' ? 'Cancel' : 'Change'}
        onAction={() => setOpen(open === 'username' ? null : 'username')}
      >
        {open === 'username' && (
          <ChangeUsernameForm
            currentUsername={currentUsername}
            onSaved={(u) => {
              setCurrentUsername(u)
              setOpen(null)
            }}
          />
        )}
      </Row>
      <Row
        label="Password"
        value="••••••••"
        actionLabel={open === 'password' ? 'Cancel' : 'Change password'}
        onAction={() => setOpen(open === 'password' ? null : 'password')}
      >
        {open === 'password' && (
          <ChangePasswordForm onDone={() => setOpen(null)} />
        )}
      </Row>
    </div>
  )
}

function Row({
  label,
  value,
  actionLabel,
  onAction,
  children,
}: {
  label: string
  value: string
  actionLabel: string
  onAction: () => void
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
            {label}
          </p>
          <p className="mt-1 font-source-serif-4 text-base text-text-primary">
            {value}
          </p>
        </div>
        <button
          type="button"
          onClick={onAction}
          className="font-dm-sans text-sm font-medium text-brand-text hover:underline"
        >
          {actionLabel}
        </button>
      </div>
      {children}
    </div>
  )
}

function ChangeEmailForm({
  currentEmail,
  onDone,
}: {
  currentEmail: string
  onDone: () => void
}) {
  const [newEmail, setNewEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSent(null)
    const trimmed = newEmail.trim().toLowerCase()
    if (!trimmed) {
      setError('Enter a new email address.')
      return
    }
    if (trimmed === currentEmail.toLowerCase()) {
      setError('That is already your current email.')
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { error: updateErr } = await supabase.auth.updateUser({
      email: trimmed,
    })
    setSaving(false)
    if (updateErr) {
      setError(updateErr.message)
      return
    }
    setSent(trimmed)
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-3 rounded-md bg-bg-sunken p-3">
        <p className="font-dm-sans text-sm text-text-secondary">
          Check your new email to confirm the change. Your sign-in email stays
          the same until you click the confirmation link.
        </p>
        <Button variant="ghost" size="sm" onClick={onDone}>
          Close
        </Button>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-md bg-bg-sunken p-3"
    >
      <Input
        label="New email address"
        type="email"
        autoComplete="email"
        value={newEmail}
        onChange={(e) => setNewEmail(e.target.value)}
        required
      />
      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" size="sm" loading={saving}>
          Save
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

type UsernameState =
  | { kind: 'idle' }
  | { kind: 'current' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'checking' }
  | { kind: 'available' }
  | { kind: 'taken' }
  | { kind: 'error' }

function validateUsernameFormat(
  raw: string,
): { ok: true } | { ok: false; reason: string } {
  if (raw.length < 3)
    return { ok: false, reason: 'Username must be at least 3 characters.' }
  if (raw.length > 30)
    return { ok: false, reason: 'Username must be 30 characters or fewer.' }
  if (!USERNAME_RE.test(raw)) {
    return {
      ok: false,
      reason:
        'Use letters, numbers, underscores, or hyphens. Cannot start or end with _ or -.',
    }
  }
  return { ok: true }
}

function ChangeUsernameForm({
  currentUsername,
  onSaved,
}: {
  currentUsername: string
  onSaved: (username: string) => void
}) {
  const [value, setValue] = useState(currentUsername)
  const [state, setState] = useState<UsernameState>({ kind: 'current' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const normalized = value.trim().toLowerCase()

  useEffect(() => {
    if (normalized === currentUsername) {
      setState({ kind: 'current' })
      return
    }
    if (normalized.length < 3) {
      setState({ kind: 'idle' })
      return
    }
    const format = validateUsernameFormat(normalized)
    if (!format.ok) {
      setState({ kind: 'invalid', reason: format.reason })
      return
    }
    setState({ kind: 'checking' })
    const controller = new AbortController()
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/username-check?username=${encodeURIComponent(normalized)}`,
          { signal: controller.signal },
        )
        if (!res.ok) {
          setState({ kind: 'error' })
          return
        }
        const body = (await res.json()) as { available: boolean }
        setState(body.available ? { kind: 'available' } : { kind: 'taken' })
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') return
        setState({ kind: 'error' })
      }
    }, 400)
    return () => {
      controller.abort()
      window.clearTimeout(t)
    }
  }, [normalized, currentUsername])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (normalized === currentUsername) {
      setError('That is already your username.')
      return
    }
    const format = validateUsernameFormat(normalized)
    if (!format.ok) {
      setError(format.reason)
      return
    }
    if (state.kind === 'taken') {
      setError('That username is taken.')
      return
    }
    setSaving(true)
    const fd = new FormData()
    fd.set('username', normalized)
    const res = await updateUsername(fd)
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    onSaved(res.username)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-md bg-bg-sunken p-3"
    >
      <Input
        label="New username"
        autoCapitalize="none"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        hint="3 to 30 characters, letters, numbers, underscores, or hyphens."
        required
      />
      <UsernameStatus state={state} />
      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          loading={saving}
          disabled={
            state.kind === 'checking' ||
            state.kind === 'taken' ||
            state.kind === 'invalid' ||
            state.kind === 'current'
          }
        >
          Save
        </Button>
      </div>
    </form>
  )
}

function UsernameStatus({ state }: { state: UsernameState }) {
  if (state.kind === 'current') {
    return (
      <p className="font-dm-sans text-xs text-text-tertiary">
        That is your current username.
      </p>
    )
  }
  if (state.kind === 'idle') return null
  if (state.kind === 'checking') {
    return (
      <p className="font-dm-sans text-xs text-text-tertiary">
        Checking availability...
      </p>
    )
  }
  if (state.kind === 'available') {
    return (
      <p className="font-dm-sans text-xs text-success">Username available.</p>
    )
  }
  if (state.kind === 'taken') {
    return (
      <p className="font-dm-sans text-xs text-error">That username is taken.</p>
    )
  }
  if (state.kind === 'invalid') {
    return <p className="font-dm-sans text-xs text-error">{state.reason}</p>
  }
  return (
    <p className="font-dm-sans text-xs text-error">
      Could not check availability. Try again.
    </p>
  )
}

function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (newPw.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }
    if (newPw !== confirmPw) {
      setError('New passwords do not match.')
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()
    const email = userData.user?.email
    if (!email) {
      setSaving(false)
      setError('Sign in again to change your password.')
      return
    }
    const { error: verifyErr } = await supabase.auth.signInWithPassword({
      email,
      password: currentPw,
    })
    if (verifyErr) {
      setSaving(false)
      setError('Current password is incorrect.')
      return
    }
    const { error: updateErr } = await supabase.auth.updateUser({
      password: newPw,
    })
    setSaving(false)
    if (updateErr) {
      setError(updateErr.message)
      return
    }
    setDone(true)
    setTimeout(() => {
      setDone(false)
      onDone()
    }, 2000)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-md bg-bg-sunken p-3"
    >
      <Input
        label="Current password"
        type="password"
        autoComplete="current-password"
        value={currentPw}
        onChange={(e) => setCurrentPw(e.target.value)}
        required
      />
      <Input
        label="New password"
        type="password"
        autoComplete="new-password"
        value={newPw}
        onChange={(e) => setNewPw(e.target.value)}
        hint="At least 8 characters."
        required
      />
      <Input
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        value={confirmPw}
        onChange={(e) => setConfirmPw(e.target.value)}
        required
      />
      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
      {done && (
        <p className="font-dm-sans text-sm text-success">Password updated.</p>
      )}
      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" size="sm" loading={saving}>
          Save
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
