import { Suspense } from 'react'
import { Footer } from '@/components/layout/footer'
import { Nav } from '@/components/layout/nav'
import { NavWithSession } from '@/components/layout/nav-with-session'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { STATIC_PAGE_METADATA } from '@/lib/metadata'

export const experimental_ppr = true

export const metadata = STATIC_PAGE_METADATA['/terms']

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <Suspense fallback={<Nav user={null} />}>
        <NavWithSession />
      </Suspense>
      <main className="flex-1">
        <PageWrapper className="max-w-prose py-12 font-source-serif-4 text-base text-text-secondary">
          <h1 className="font-fraunces text-[2.25rem] text-text-primary">
            Terms of service
          </h1>
          <p className="mt-2 font-dm-mono text-xs text-text-tertiary">
            Last updated 2026-05-17
          </p>

          <Section heading="The short version">
            Read the books, save passages, talk about them with other
            readers. Don&apos;t abuse the AI, the community, or other
            people. Keep your account credentials private. That covers most
            of it.
          </Section>

          <Section heading="Your account">
            You&apos;re responsible for what happens under your account.
            One human per account. We can suspend accounts that break these
            terms.
          </Section>

          <Section heading="Content you post">
            You keep ownership of what you write. By posting publicly, you
            give Foxing a license to display it on the platform. If you
            delete it, we stop showing it.
          </Section>

          <Section heading="Catalog content">
            Books in the catalog are public-domain editions, primarily from
            Standard Ebooks and Project Gutenberg. Where copyright applies,
            we honor it.
          </Section>

          <Section heading="AI output">
            AI summaries and analysis are provided as-is. They can be
            wrong. Don&apos;t treat them as the last word on the book.
          </Section>

          <Section heading="Paid plans">
            Paid plans renew automatically until canceled. Cancel any time
            from settings. Refunds at our discretion within seven days of
            charge.
          </Section>

          <Section heading="Termination">
            You can delete your account whenever. We can terminate accounts
            that abuse the service or violate the law.
          </Section>

          <Section heading="No warranty">
            The service is provided as-is. We aim for uptime but
            can&apos;t guarantee it.
          </Section>

          <Section heading="Governing law">
            Texas, USA.
          </Section>

          <Section heading="Contact">
            <a
              href="mailto:legal@foxing.app"
              className="text-brand-text hover:underline"
            >
              legal@foxing.app
            </a>
          </Section>
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}

function Section({
  heading,
  children,
}: {
  heading: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-6">
      <h2 className="font-fraunces text-lg text-text-primary">{heading}</h2>
      <p className="mt-2">{children}</p>
    </section>
  )
}
