import Link from 'next/link'
import { Footer } from '@/components/layout/footer'
import { Nav } from '@/components/layout/nav'
import { NotFoundLogger } from '@/components/not-found-logger'
import { PageWrapper } from '@/components/layout/page-wrapper'

export const metadata = {
  title: 'Not found',
  robots: { index: false, follow: true },
}

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NotFoundLogger />
      <Nav user={null} />
      <main className="flex-1">
        <PageWrapper className="max-w-prose py-16 text-center">
          <p className="font-dm-mono text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
            404
          </p>
          <h1 className="mt-3 font-fraunces text-[2.5rem] text-text-primary">
            That page is not here.
          </h1>
          <p className="mt-4 font-source-serif-4 text-base text-text-secondary">
            The link may be old or the page may have moved. Try the
            catalog or head home.
          </p>
          <p className="mt-6 flex flex-wrap justify-center gap-4 font-dm-sans text-sm">
            <Link href="/" className="text-brand-text hover:underline">
              Home
            </Link>
            <Link href="/books" className="text-brand-text hover:underline">
              Browse books
            </Link>
            <Link href="/search" className="text-brand-text hover:underline">
              Search
            </Link>
          </p>
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}
