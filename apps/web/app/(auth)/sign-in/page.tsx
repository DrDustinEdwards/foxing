import type { Metadata } from 'next'
import { SignInForm } from './sign-in-form'

export const metadata: Metadata = {
  title: 'Sign in to Foxing',
}

export default async function SignInPage(
  props: {
    searchParams: Promise<{ next?: string }>
  }
) {
  const searchParams = await props.searchParams;
  return <SignInForm nextPath={searchParams.next ?? '/library'} />
}
