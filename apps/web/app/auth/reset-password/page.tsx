import type { Metadata } from 'next'
import { ResetPasswordForm } from './reset-password-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Set a new password',
  robots: { index: false, follow: false },
}

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-16">
      <ResetPasswordForm />
    </main>
  )
}
