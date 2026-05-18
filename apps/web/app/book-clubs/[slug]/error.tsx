'use client'

import Link from 'next/link'
import { useEffect } from 'react'

export default function BookClubError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[book-clubs/[slug]] render error', error)
  }, [error])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg-base px-6 text-center">
      <h1 className="font-fraunces text-3xl text-text-primary">
        We could not load this book club.
      </h1>
      <p className="mt-3 max-w-prose font-source-serif-4 text-base text-text-secondary">
        Something went wrong on our side. Try again in a moment, or head back
        to the full list of celebrity picks.
      </p>
      <div className="mt-6 flex gap-4 font-dm-sans text-sm">
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-border-subtle px-4 py-2 hover:border-border-interactive"
        >
          Try again
        </button>
        <Link
          href="/book-clubs"
          className="rounded-md border border-border-subtle px-4 py-2 hover:border-border-interactive"
        >
          All celebrity picks
        </Link>
      </div>
    </main>
  )
}
