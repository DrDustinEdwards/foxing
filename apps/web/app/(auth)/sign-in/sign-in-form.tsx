'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AuthCard } from '@/components/ui/auth-card'
import { Button } from '@/components/ui/button'
import { ErrorMessage } from '@/components/ui/error-message'
import { Input } from '@/components/ui/input'
import { OAuthButtons } from '@/components/ui/oauth-buttons'
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
    <AuthCard>
      <h1 className="font-fraunces text-2xl text-text-primary">Sign in to Foxing</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          hint="Don't know your username? Sign in with your email. You can find your username in Settings."
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <ErrorMessage message={error} />
        <Button type="submit" variant="primary" fullWidth loading={loading}>
          Sign in
        </Button>
      </form>

      <Divider />

      <OAuthButtons onSelect={handleOAuth} />

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
    </AuthCard>
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
