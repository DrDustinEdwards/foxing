'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

type Status =
  | { kind: 'verifying' }
  | { kind: 'ready' }
  | { kind: 'invalid'; message: string }

export function ResetPasswordForm() {
  const router = useRouter()
  const [status, setStatus] = useState<Status>({ kind: 'verifying' })
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    async function verify() {
      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')

      if (code) {
        const { error: exErr } = await supabase.auth.exchangeCodeForSession(code)
        if (cancelled) return
        if (exErr) {
          setStatus({
            kind: 'invalid',
            message:
              'This reset link is invalid or expired. Request a new one to continue.',
          })
          return
        }
        // Strip the code from the URL so a refresh doesn't try to reuse it.
        window.history.replaceState(null, '', url.pathname)
      }

      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      if (!data.session) {
        setStatus({
          kind: 'invalid',
          message:
            'This reset link is invalid or expired. Request a new one to continue.',
        })
        return
      }
      setStatus({ kind: 'ready' })
    }

    verify()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { error: updateErr } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (updateErr) {
      setError(updateErr.message)
      return
    }
    router.replace('/library')
    router.refresh()
  }

  if (status.kind === 'verifying') {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-border-subtle bg-bg-surface p-6 shadow-sm">
        <h1 className="font-fraunces text-2xl text-text-primary">
          Verifying reset link...
        </h1>
        <p className="font-source-serif-4 text-sm text-text-secondary">
          One moment.
        </p>
      </div>
    )
  }

  if (status.kind === 'invalid') {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-border-subtle bg-bg-surface p-6 shadow-sm">
        <h1 className="font-fraunces text-2xl text-text-primary">
          Reset link expired
        </h1>
        <p className="font-source-serif-4 text-sm text-text-secondary">
          {status.message}
        </p>
        <Link
          href="/forgot-password"
          className="font-dm-sans text-sm text-brand-text hover:underline"
        >
          Request a new link
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-border-subtle bg-bg-surface p-6 shadow-sm">
      <h1 className="font-fraunces text-2xl text-text-primary">
        Set a new password
      </h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="At least 8 characters."
        />
        <Input
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {error && (
          <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" fullWidth loading={saving}>
          Save new password
        </Button>
      </form>
    </div>
  )
}
