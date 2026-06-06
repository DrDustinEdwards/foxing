'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AuthCard } from '@/components/ui/auth-card'
import { Button } from '@/components/ui/button'
import { ErrorMessage } from '@/components/ui/error-message'
import { Input } from '@/components/ui/input'
import { OAuthButtons } from '@/components/ui/oauth-buttons'
import { createClient } from '@/lib/supabase/client'
import { validateUsernameFormat } from '@/lib/username'

type UsernameState =
  | { kind: 'idle' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'checking' }
  | { kind: 'available' }
  | { kind: 'taken' }
  | { kind: 'error' }

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
    <AuthCard>
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
        <ErrorMessage message={error} />
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

      <OAuthButtons onSelect={handleOAuth} />

      <p className="text-center font-dm-sans text-sm text-text-tertiary">
        Already have an account?{' '}
        <Link href="/sign-in" className="text-brand-text hover:underline">
          Sign in
        </Link>
      </p>
    </AuthCard>
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
