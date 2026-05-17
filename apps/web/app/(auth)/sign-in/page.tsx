import type { Metadata } from 'next'
import { SignInForm } from './sign-in-form'

export const metadata: Metadata = {
  title: 'Sign in to Foxing',
}

export default function SignInPage({
  searchParams,
}: {
  searchParams: { next?: string }
}) {
  return <SignInForm nextPath={searchParams.next ?? '/library'} />
}
