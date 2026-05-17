import type { Metadata } from 'next'
import { Footer } from '@/components/layout/footer'
import { Nav } from '@/components/layout/nav'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { getNavUser } from '@/lib/nav-user'
import { siteOrigin } from '@/lib/foxing'

export const revalidate = 86_400

export const metadata: Metadata = {
  title: 'Privacy · Foxing',
  alternates: { canonical: `${siteOrigin()}/privacy` },
}

export default async function PrivacyPage() {
  const navUser = await getNavUser()
  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <Nav user={navUser} />
      <main className="flex-1">
        <PageWrapper className="max-w-prose py-12 font-source-serif-4 text-base text-text-secondary">
          <h1 className="font-fraunces text-[2.25rem] text-text-primary">
            Privacy
          </h1>
          <p className="mt-2 font-dm-mono text-xs text-text-tertiary">
            Last updated 2026-05-17
          </p>

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
            book&apos;s metadata are sent to Anthropic for inference. They
            don&apos;t train models on your data per their API terms.
            Nothing else is sent.
          </Section>

          <Section heading="Retention and deletion">
            Delete your account at any time from settings. We remove your
            profile, books, highlights, and reviews within 30 days. Backups
            roll off within 90 days.
          </Section>

          <Section heading="Cookies">
            We use cookies for sign-in sessions and CSRF protection.
            That&apos;s the whole set.
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
