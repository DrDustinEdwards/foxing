'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$/

type UsernameState =
  | { kind: 'idle' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'checking' }
  | { kind: 'available' }
  | { kind: 'taken' }
  | { kind: 'error' }

function validateUsernameFormat(raw: string): { ok: true } | { ok: false; reason: string } {
  if (raw.length < 3) return { ok: false, reason: 'Username must be at least 3 characters.' }
  if (raw.length > 30) return { ok: false, reason: 'Username must be 30 characters or fewer.' }
  if (!USERNAME_RE.test(raw)) {
    return {
      ok: false,
      reason:
        'Use letters, numbers, underscores, or hyphens. Cannot start or end with _ or -.',
    }
  }
  return { ok: true }
}

export function SignUpForm() {
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [usernameState, setUsernameState] = useState<UsernameState>({ kind: 'idle' })

  const normalizedUsername = username.trim().toLowerCase()

  useEffect(() => {
    if (normalizedUsername.length < 3) {
      setUsernameState({ kind: 'idle' })
      return
    }
    const formatCheck = validateUsernameFormat(normalizedUsername)
    if (!formatCheck.ok) {
      setUsernameState({ kind: 'invalid', reason: formatCheck.reason })
      return
    }
    setUsernameState({ kind: 'checking' })
    const controller = new AbortController()
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/username-check?username=${encodeURIComponent(normalizedUsername)}`,
          { signal: controller.signal },
        )
        if (!res.ok) {
          setUsernameState({ kind: 'error' })
          return
        }
        const body = (await res.json()) as { available: boolean }
        setUsernameState(body.available ? { kind: 'available' } : { kind: 'taken' })
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') return
        setUsernameState({ kind: 'error' })
      }
    }, 400)
    return () => {
      controller.abort()
      window.clearTimeout(t)
    }
  }, [normalizedUsername])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    const formatCheck = validateUsernameFormat(normalizedUsername)
    if (!formatCheck.ok) {
      setError(formatCheck.reason)
      return
    }
    if (usernameState.kind === 'taken') {
      setError('That username is taken. Please choose another.')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName, username: normalizedUsername },
        emailRedirectTo: `${window.location.origin}/callback?next=/library`,
      },
    })
    setLoading(false)
    if (signUpError) {
      const msg = signUpError.message
      if (
        /duplicate|unique|already|conflict/i.test(msg) &&
        /username/i.test(msg)
      ) {
        setError('That username was just taken. Please choose another.')
      } else if (/duplicate|unique/i.test(msg) && /profile|username/i.test(msg)) {
        setError('That username was just taken. Please choose another.')
      } else {
        setError(msg)
      }
      return
    }
    router.push('/library')
    router.refresh()
  }

  async function handleOAuth(provider: 'google' | 'apple') {
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/callback?next=/library`,
      },
    })
    if (oauthError) {
      setError(oauthError.message)
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-border-subtle bg-bg-surface p-6 shadow-sm">
      <h1 className="font-fraunces text-2xl text-text-primary">Create your account</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Display name"
          autoComplete="name"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="flex flex-col gap-1.5">
          <Input
            label="Username"
            autoComplete="username"
            required
            minLength={3}
            maxLength={30}
            hint="3-30 characters. Letters, numbers, underscores, or hyphens. This appears in your profile URL."
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <UsernameStatus state={usernameState} username={normalizedUsername} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={8}
            hint="At least 8 characters."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="self-end font-dm-sans text-xs text-text-tertiary hover:text-text-primary"
          >
            {showPassword ? 'Hide password' : 'Show password'}
          </button>
        </div>
        {error && (
          <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
            {error}
          </p>
        )}
        <Button
          type="submit"
          variant="primary"
          fullWidth
          loading={loading}
          disabled={usernameState.kind === 'taken' || usernameState.kind === 'checking'}
        >
          Create account
        </Button>
      </form>

      <Divider />

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => handleOAuth('apple')}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#000000] font-dm-sans text-sm font-medium text-white hover:opacity-90"
        >
          Continue with Apple
        </button>
        <button
          type="button"
          onClick={() => handleOAuth('google')}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-border-interactive bg-bg-surface font-dm-sans text-sm font-medium text-text-primary hover:bg-bg-hover"
        >
          Continue with Google
        </button>
      </div>

      <p className="text-center font-dm-sans text-sm text-text-tertiary">
        Already have an account?{' '}
        <Link href="/sign-in" className="text-brand-text hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}

function UsernameStatus({
  state,
  username,
}: {
  state: UsernameState
  username: string
}) {
  if (state.kind === 'idle') return null
  if (state.kind === 'invalid') {
    return (
      <p className="font-dm-sans text-xs text-error" aria-live="polite">
        {state.reason}
      </p>
    )
  }
  if (state.kind === 'checking') {
    return (
      <p className="font-dm-sans text-xs text-text-tertiary" aria-live="polite">
        Checking...
      </p>
    )
  }
  if (state.kind === 'available') {
    return (
      <p className="font-dm-sans text-xs text-success" aria-live="polite">
        {username} is available
      </p>
    )
  }
  if (state.kind === 'taken') {
    return (
      <p className="font-dm-sans text-xs text-error" aria-live="polite">
        {username} is taken
      </p>
    )
  }
  return (
    <p className="font-dm-sans text-xs text-text-tertiary" aria-live="polite">
      Could not check availability. Try again.
    </p>
  )
}

function Divider() {
  return (
    <div className="flex items-center gap-3 text-text-tertiary">
      <div className="h-px flex-1 bg-border-subtle" />
      <span className="font-dm-sans text-xs uppercase tracking-wider">or</span>
      <div className="h-px flex-1 bg-border-subtle" />
    </div>
  )
}
