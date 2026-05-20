import Link from 'next/link'
import { type ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <header className="px-6 py-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-fraunces text-xl text-brand-ui"
        >
          <span aria-hidden="true">🦊</span>
          Foxing
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-6 pb-16 pt-4 md:items-center md:pt-0">
        <div className="w-full max-w-[400px]">{children}</div>
      </main>
    </div>
  )
}
