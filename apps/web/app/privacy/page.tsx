import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { PageHeader } from '@/components/ui/page-header'
import { STATIC_PAGE_METADATA } from '@/lib/metadata'

export const dynamic = 'force-static'

export const metadata = STATIC_PAGE_METADATA['/privacy']

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <PageWrapper className="max-w-prose py-12 font-source-serif-4 text-base text-text-secondary">
          <PageHeader title="Privacy" subtitle="Last updated 2026-06-12" />

          <Section heading="What we collect">
            Your account email, the books on your shelves, the highlights
            you save, and any reviews you write. If you post publicly, the
            content is public. If you mark it private, it stays private.
          </Section>

          <Section heading="How we use it">
            To run the product. To improve recommendations. To answer your
            support email. Nothing else.
          </Section>

          <Section heading="What we don’t do">
            We don&apos;t sell your data. We don&apos;t share it with ad
            networks. We don&apos;t track you across the web. There are no
            third-party advertising trackers on this site.
          </Section>

          <Section heading="AI processing">
            When you use the AI companion, the passage you tap and the
            book&apos;s metadata are sent to our AI provider for inference.
            The provider doesn&apos;t train models on your data per its API
            terms. Nothing else is sent.
          </Section>

          <Section heading="Your rights">
            You can see, correct, export, and delete your data. Export a
            JSON archive of everything from settings. If you live somewhere
            with a privacy law like the GDPR or the CCPA, those rights
            apply and we honor them for everyone anyway. Questions go to
            the address below.
          </Section>

          <Section heading="Retention and deletion">
            Delete your account at any time from settings. Your profile,
            books, highlights, reviews, and reading history are removed
            immediately. Posts you wrote in shared spaces, like club
            discussions, stay but are unlinked from you and show no author.
            Backups roll off within 90 days.
          </Section>

          <Section heading="Cookies and analytics">
            We use cookies for sign-in sessions and CSRF protection.
            That&apos;s the whole set. Page analytics are aggregate and
            cookie-free; they don&apos;t identify you or follow you to
            other sites.
          </Section>

          <Section heading="Children">
            Foxing is not for children under 13, and we don&apos;t
            knowingly collect their data. If you believe a child under 13
            has an account, write to the address below and we&apos;ll
            delete it.
          </Section>

          <Section heading="Contact">
            <a
              href="mailto:privacy@foxing.app"
              className="text-brand-text hover:underline"
            >
              privacy@foxing.app
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
