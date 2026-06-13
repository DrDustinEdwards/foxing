'use client'

import Link from 'next/link'
import { useSession } from '@/components/providers/session-provider'

// Client-gated so the clubs index stays statically cached (ISR): the button
// is rendered only once the session resolves to a signed-in user. Mirrors the
// Button primary variant (bg-brand-ui / text-on-amber / md size).
export function StartClubButton() {
  const { user, isLoading } = useSession()
  if (isLoading || !user) return null
  return (
    <Link
      href="/clubs/new"
      className="inline-flex h-11 shrink-0 items-center justify-center rounded-md bg-brand-ui px-4 font-dm-sans text-base font-medium text-text-on-amber no-underline transition-all hover:bg-brand-hover active:scale-[0.97]"
    >
      Start a club
    </Link>
  )
}
