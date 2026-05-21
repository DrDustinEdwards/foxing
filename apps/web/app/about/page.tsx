import { Suspense } from 'react'
import { Footer } from '@/components/layout/footer'
import { Nav } from '@/components/layout/nav'
import { NavWithSession } from '@/components/layout/nav-with-session'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { STATIC_PAGE_METADATA } from '@/lib/metadata'

export const metadata = STATIC_PAGE_METADATA['/about']

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <Suspense fallback={<Nav user={null} />}>
        <NavWithSession />
      </Suspense>
      <main className="flex-1">
        <PageWrapper className="max-w-prose py-14">
          <h1 className="font-fraunces text-[2.5rem] text-text-primary">
            About Foxing
          </h1>
          <p className="mt-6 font-source-serif-4 text-base text-text-secondary">
            Foxing is a reader, a quiet club, and an AI that reads with you.
            The name comes from the brown spots that bloom on the pages of
            old books. The kind of book that&apos;s been carried, marked,
            and remembered.
          </p>
          <p className="mt-4 font-source-serif-4 text-base text-text-secondary">
            The catalog is public-domain literature, formatted properly for
            a phone. The AI explains words and passages in context, without
            taking you out of the book. The social layer is small on purpose.
            No follower counts on display. No infinite scroll designed to
            keep you off the book.
          </p>
          <p className="mt-4 font-source-serif-4 text-base text-text-secondary">
            Built by Dustin Edwards. One person, one inbox. Email
            <a
              href="mailto:hello@foxing.app"
              className="text-brand-text hover:underline"
            >
              {' '}
              hello@foxing.app
            </a>{' '}
            with anything.
          </p>
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}
