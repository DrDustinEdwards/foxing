'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

export function SignInForm({ nextPath }: { nextPath: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    setLoading(false)
    if (signInError) {
      setError(signInError.message)
      return
    }
    router.push(nextPath)
    router.refresh()
  }

  async function handleOAuth(provider: 'google' | 'apple') {
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/callback?next=${encodeURIComponent(nextPath)}`,
      },
    })
    if (oauthError) {
      setError(oauthError.message)
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-border-subtle bg-bg-surface p-6 shadow-sm">
      <h1 className="font-fraunces text-2xl text-text-primary">Sign in to Foxing</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" fullWidth loading={loading}>
          Sign in
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

      <div className="flex flex-col gap-2 text-center font-dm-sans text-sm">
        <Link href="/forgot-password" className="text-brand-text hover:underline">
          Forgot password?
        </Link>
        <p className="text-text-tertiary">
          New to Foxing?{' '}
          <Link href="/sign-up" className="text-brand-text hover:underline">
            Join free
          </Link>
        </p>
      </div>
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
