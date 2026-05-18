'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      },
    )
    setLoading(false)
    if (resetError) {
      setError(resetError.message)
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-border-subtle bg-bg-surface p-6 shadow-sm">
        <h1 className="font-fraunces text-2xl text-text-primary">Check your email</h1>
        <p className="font-source-serif-4 text-sm text-text-secondary">
          If an account exists for {email}, a reset link is on its way.
        </p>
        <Link href="/sign-in" className="font-dm-sans text-sm text-brand-text hover:underline">
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-border-subtle bg-bg-surface p-6 shadow-sm">
      <h1 className="font-fraunces text-2xl text-text-primary">Reset your password</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {error && (
          <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" fullWidth loading={loading}>
          Send reset link
        </Button>
      </form>
      <Link href="/sign-in" className="text-center font-dm-sans text-sm text-brand-text hover:underline">
        Back to sign in
      </Link>
    </div>
  )
}
