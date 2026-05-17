'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

export function SignUpForm() {
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: `${window.location.origin}/callback?next=/library`,
      },
    })
    setLoading(false)
    if (signUpError) {
      setError(signUpError.message)
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
        <Button type="submit" variant="primary" fullWidth loading={loading}>
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

function Divider() {
  return (
    <div className="flex items-center gap-3 text-text-tertiary">
      <div className="h-px flex-1 bg-border-subtle" />
      <span className="font-dm-sans text-xs uppercase tracking-wider">or</span>
      <div className="h-px flex-1 bg-border-subtle" />
    </div>
  )
}
